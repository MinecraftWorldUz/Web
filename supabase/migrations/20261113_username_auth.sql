-- Minecraft World username authentication migration.
-- Run in Supabase SQL Editor after the original website schema.
BEGIN;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS login_email;
CREATE UNIQUE INDEX IF NOT EXISTS mw_username_unique ON public.profiles(lower(username));

CREATE SCHEMA IF NOT EXISTS mw_auth_private;
REVOKE ALL ON SCHEMA mw_auth_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS mw_auth_private.login_limits(
  scope text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE mw_auth_private.login_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mw_auth_private.login_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mw_auth_limit(p_key text, p_limit integer, p_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE allowed boolean;
BEGIN
 IF length(p_key) NOT BETWEEN 1 AND 120 OR p_limit NOT BETWEEN 1 AND 1000 OR p_seconds NOT BETWEEN 1 AND 86400
 THEN RAISE EXCEPTION 'Invalid limit'; END IF;
 INSERT INTO mw_auth_private.login_limits AS lim(scope,attempts,expires_at)
 VALUES(p_key,1,clock_timestamp()+make_interval(secs => p_seconds))
 ON CONFLICT(scope) DO UPDATE
 SET attempts=CASE WHEN lim.expires_at <= clock_timestamp() THEN 1 ELSE least(lim.attempts+1,p_limit+1) END,
 expires_at=CASE WHEN lim.expires_at <= clock_timestamp() THEN clock_timestamp()+make_interval(secs => p_seconds) ELSE lim.expires_at END
 RETURNING attempts <= p_limit INTO allowed;
 RETURN allowed;
END $$;
REVOKE ALL ON FUNCTION public.mw_auth_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mw_auth_limit(text,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.mw_auth_lookup(p_username text)
RETURNS TABLE(user_id uuid,internal_email text,blocked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT p.id,u.email::text,
 COALESCE(p.banned_permanently,false) OR COALESCE(p.banned_until>now(),false)
 FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE lower(p.username)=lower(trim(p_username)) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.mw_auth_lookup(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mw_auth_lookup(text) TO service_role;

-- Prevent reserved name hijacking and lock admin handle.
CREATE OR REPLACE FUNCTION public.mw_username_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 new.username:=lower(trim(new.username));
 IF new.username IS NULL OR new.username !~ '^[a-z0-9_]{3,20}$'
 THEN RAISE EXCEPTION 'Invalid username'; END IF;
 IF tg_op='UPDATE' AND old.is_admin AND new.username IS DISTINCT FROM old.username
 THEN RAISE EXCEPTION 'Admin handle cannot change'; END IF;
 IF new.username='admin' AND NOT new.is_admin
 THEN RAISE EXCEPTION 'Admin username is reserved'; END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS mw_username_guard ON public.profiles;
CREATE TRIGGER mw_username_guard BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.mw_username_guard();

-- Supabase Auth admin.createUser sets this trusted app_metadata marker.
CREATE OR REPLACE FUNCTION public.create_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n text; number bigint;
BEGIN
 IF new.raw_app_meta_data->>'mw_username_auth' IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'Use username-auth registration'; END IF;
 n:=lower(trim(new.raw_user_meta_data->>'username'));
 IF n IS NULL OR n !~ '^[a-z0-9_]{3,20}$' OR n='admin'
 THEN RAISE EXCEPTION 'Invalid or reserved username'; END IF;
 UPDATE public.site_counter
 SET last_id=greatest(last_id,coalesce((SELECT max(public_id) FROM public.profiles),0))+1
 WHERE singleton=true RETURNING last_id INTO number;
 IF number IS NULL THEN RAISE EXCEPTION 'Counter missing'; END IF;
 INSERT INTO public.profiles(id,public_id,username) VALUES(new.id,number,n);
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.create_profile() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_profile();

-- Frontend must never set admin, ban, verification, or ID fields.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profiles TO anon,authenticated;
GRANT UPDATE(username,bio,avatar_url) ON public.profiles TO authenticated;

COMMIT;
