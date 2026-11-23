-- Nobody signed out may call any of these; the trigger function is never called directly.
revoke execute on function public.link_staff() from public, anon, authenticated;
revoke execute on function public.my_clinic() from public, anon;
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.is_my_referral(text, text) from public, anon;
revoke execute on function public.replace_referrals(text, jsonb) from public, anon;
revoke execute on function public.publish_estimates(text, jsonb, jsonb) from public, anon;
-- Signed-in people need these for the row-level security checks; the two write
-- functions check the caller's clinic and role themselves.
grant execute on function public.my_clinic() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_my_referral(text, text) to authenticated;
grant execute on function public.replace_referrals(text, jsonb) to authenticated;
grant execute on function public.publish_estimates(text, jsonb, jsonb) to authenticated;
-- staff_invites is read only by the sign-up trigger; no policy on purpose.
comment on table public.staff_invites is 'Read only by link_staff(); no client access by design.';
