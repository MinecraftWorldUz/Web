# Minecraft World — username + password authentication

GitHub Pages only hosts the frontend. Supabase Edge Functions is the login backend. The website uses `index.html`; no `app.js` file is required.

## Required manual Supabase setup

1. Back up the Supabase project if it already has users/posts.
2. Run `supabase/migrations/20261113_username_auth.sql` **once** in Supabase > SQL Editor. This assumes the previous Minecraft World tables already exist; do not run it on an empty database.
3. Supabase > Authentication > Sign In / Providers (or Authentication > Providers): Email provider **ON**; Confirm email **ON**; Allow new user sign-ups **OFF**; anonymous sign-ins **OFF**. The backend uses admin.createUser and confirms the hidden technical email.
4. Supabase > Edge Functions > Deploy a new function > Via Editor. Name: `username-auth`. Paste `supabase/functions/username-auth/index.ts`, deploy. Set Verify JWT **OFF** for this function; it handles initial login before the user has a token.
5. Ensure the hosted Edge Function has the managed `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables. **Never put the service role key in frontend code.**
6. Test username + password signup and sign-in on https://minecraftworlduz.github.io/Web/ only after SQL and function are deployed.

## Existing @admin account

The username `admin` is reserved against public signup. Create an ordinary username yourself, identify its UUID in Supabase Authentication > Users and promote that **specific UUID** in SQL Editor:

```sql
update public.profiles set username='admin', is_admin=true
where id='PUT-YOUR-USER-UUID-HERE'::uuid;
```

If another account already owns `admin`, investigate first and do not promote an arbitrary account. The current profile IDs do not change.

## Caveats

- Site should remain private/test-only until RLS and moderation features are tested.
- No email recovery is available in this username-only flow; add a secure recovery mechanism before public launch.
- Attempts are limited by username and by global quotas; global quotas may affect legitimate traffic under abuse.
- No changes to the live Supabase database or function are made by GitHub commits.
