-- Lets the sign-up webhook (app/api/auth-webhooks/before-create) check the
-- allowlist. It runs before the person has an account, so mates_app has no
-- user set and the allowed_emails policy would hide every row. This answers
-- yes or no for one email without exposing the list.

create function public.is_allowed_signup(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.allowed_emails where email = lower(p_email));
$$;

revoke execute on function public.is_allowed_signup(text) from public;
grant execute on function public.is_allowed_signup(text) to mates_app;
