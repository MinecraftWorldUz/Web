create table public.mw_push_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (length(endpoint) <= 2048 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-zA-Z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)/'),
  p256dh text not null check(length(p256dh) between 80 and 100),
  auth text not null check(length(auth) between 20 and 32),
  primary key(user_id,endpoint)
);
alter table public.mw_push_devices enable row level security;
revoke all on public.mw_push_devices from anon,authenticated;
grant select,insert,update,delete on public.mw_push_devices to authenticated,service_role;
create policy own_push_devices on public.mw_push_devices to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

select vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text,'mw_push_dispatch');
create function public.mw_push_credentials() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_object_agg(name,decrypted_secret) from vault.decrypted_secrets
 where name in ('mw_push_dispatch','mw_push_private','mw_push_public')
$$;
revoke all on function public.mw_push_credentials() from public,anon,authenticated;
grant execute on function public.mw_push_credentials() to service_role;

create function public.mw_queue_push() returns trigger language plpgsql security definer set search_path='' as $$
declare dispatch_token text;
begin
 if new.kind in ('message','follow','review') and exists(select 1 from public.mw_push_devices where user_id=new.user_id) then
   select decrypted_secret into dispatch_token from vault.decrypted_secrets where name='mw_push_dispatch';
   perform net.http_post(url:='https://ruovdgyfcucspffrvijh.supabase.co/functions/v1/mw-web-push',
     headers:=jsonb_build_object('Content-Type','application/json','X-MW-Dispatch',dispatch_token),
     body:=jsonb_build_object('id',new.id),timeout_milliseconds:=20000);
 end if;
 return new;
exception when others then
 raise warning 'Could not enqueue Minecraft World push';
 return new;
end $$;
revoke all on function public.mw_queue_push() from public,anon,authenticated;
create trigger mw_push_notice after insert on public.notifications for each row execute function public.mw_queue_push();
