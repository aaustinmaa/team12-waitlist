-- ClearWait (Early Birds, Team 12): hosted schema (Supabase / Postgres). Create the project in
-- Canada (Central).
--
-- Who can see what is enforced here, by row-level security, not by the app:
-- - clinic staff see and change only their own clinic's data, by role
--   (admin imports and manages, intake works the waitlist, manager reads);
-- - a family sees only the referrals whose email matches the email they
--   signed in with, and only what the clinic published for those referrals
--   (status, the range if the estimates passed the back-test, updates).
--
-- The estimator runs in the clinic portal: after every import or staff change
-- it publishes each referral's estimate to `estimates` and a clinic summary to
-- `clinic_summary`. Families never need the whole waitlist.

-- ---------------------------------------------------------------- clinics and staff

create table clinics (
  id text primary key,
  name text not null
);

create type staff_role as enum ('admin', 'intake', 'manager');

-- Accounts a clinic admin has invited. When that person's account is created
-- (Authentication → Users), they are linked to the clinic automatically.
create table staff_invites (
  email text primary key,
  clinic_id text not null references clinics on delete cascade,
  role staff_role not null,
  name text not null
);

create table staff_members (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null,
  clinic_id text not null references clinics on delete cascade,
  role staff_role not null,
  name text not null
);

create function link_staff() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.staff_members (user_id, email, clinic_id, role, name)
  select new.id, new.email, i.clinic_id, i.role, i.name from public.staff_invites i where lower(i.email) = lower(new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.link_staff();

create function my_clinic() returns text language sql stable security definer set search_path = public as $$
  select clinic_id from staff_members where user_id = auth.uid()
$$;
create function my_role() returns staff_role language sql stable security definer set search_path = public as $$
  select role from staff_members where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------- referral data

-- One row per referral, in the canonical shape (web/src/engine/types.ts). Replaced by each import.
create table referrals (
  clinic_id text not null references clinics on delete cascade,
  referral_id text not null,
  service text not null default '',
  priority text not null default 'standard' check (priority in ('urgent', 'high', 'standard')),
  received_on date not null,
  intake_completed_on date,
  hold_start date,
  hold_end date,
  hold_reason text,
  booked_for date,
  booked_time text,
  clinician text,
  closed_on date,
  close_reason text check (close_reason in ('assessed', 'withdrawn')),
  withdrawn_reason text,
  age_group text,
  referral_source text,
  family_email text,
  family_phone text,
  needs_review boolean not null default false,
  primary key (clinic_id, referral_id)
);
create index referrals_family_email on referrals (lower(family_email));

create function is_my_referral(c text, r text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from referrals x
    where x.clinic_id = c and x.referral_id = r
      and x.family_email is not null and lower(x.family_email) = lower(auth.jwt() ->> 'email')
  )
$$;

-- The clinic's working state: staff changes on top of the import (priority
-- with reasons, intake done, capacity scenario, what each family was last
-- told), the saved mapping recipe, and what the latest import was.
create table clinic_state (
  clinic_id text primary key references clinics on delete cascade,
  ops jsonb not null default '{}',
  recipe jsonb,
  data_as_of date,
  file_name text,
  via text,
  imported_at timestamptz
);

create table imports (
  id bigint generated always as identity primary key,
  clinic_id text not null references clinics on delete cascade,
  at timestamptz not null default now(),
  by_email text not null,
  via text not null,
  file_name text not null,
  data_as_of date not null,
  rows integer not null,
  records integer not null,
  errors integer not null,
  warnings integer not null,
  diff jsonb,
  recipe_by text not null
);

-- ---------------------------------------------------------------- what families see

create table estimates (
  clinic_id text not null references clinics on delete cascade,
  referral_id text not null,
  status text not null,
  position integer,
  lower_weeks integer,
  upper_weeks integer,
  reason text,
  primary key (clinic_id, referral_id)
);

-- Non-identifying facts about the clinic and how well its estimates did (shown on the family page).
create table clinic_summary (
  clinic_id text primary key references clinics on delete cascade,
  summary jsonb not null,
  updated_at timestamptz not null default now()
);

create table notices (
  id text primary key,
  clinic_id text not null references clinics on delete cascade,
  referral_id text not null,
  notice jsonb not null,
  at timestamptz not null default now()
);

create table family_prefs (
  clinic_id text not null references clinics on delete cascade,
  referral_id text not null,
  notify jsonb,
  contacts jsonb,
  primary key (clinic_id, referral_id)
);

create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  clinic_id text references clinics,
  actor text not null,
  action text not null,
  detail text not null,
  referral_id text
);

-- ---------------------------------------------------------------- writes that must be all-or-nothing

-- Replace a clinic's referrals with a new import. Clinic admins only.
create function replace_referrals(p_clinic text, p_rows jsonb) returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if my_clinic() is distinct from p_clinic or my_role() <> 'admin' then raise exception 'Only this clinic''s admin can import data'; end if;
  delete from referrals where clinic_id = p_clinic;
  insert into referrals select * from jsonb_populate_recordset(null::referrals, p_rows) r where r.clinic_id = p_clinic;
  get diagnostics n = row_count;
  return n;
end $$;

-- Publish what families see after an import or a staff change. Admin and intake staff.
create function publish_estimates(p_clinic text, p_rows jsonb, p_summary jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if my_clinic() is distinct from p_clinic or my_role() not in ('admin', 'intake') then raise exception 'Not allowed'; end if;
  delete from estimates where clinic_id = p_clinic;
  insert into estimates select * from jsonb_populate_recordset(null::estimates, p_rows) e where e.clinic_id = p_clinic;
  insert into clinic_summary (clinic_id, summary, updated_at) values (p_clinic, p_summary, now())
    on conflict (clinic_id) do update set summary = excluded.summary, updated_at = now();
end $$;

-- ---------------------------------------------------------------- row-level security

alter table clinics enable row level security;
alter table staff_invites enable row level security;
alter table staff_members enable row level security;
alter table referrals enable row level security;
alter table clinic_state enable row level security;
alter table imports enable row level security;
alter table estimates enable row level security;
alter table clinic_summary enable row level security;
alter table notices enable row level security;
alter table family_prefs enable row level security;
alter table audit_log enable row level security;

create policy "anyone signed in reads clinic names" on clinics for select to authenticated using (true);
create policy "staff read their own membership and team" on staff_members for select to authenticated using (user_id = auth.uid() or clinic_id = my_clinic());

create policy "staff read their clinic's referrals" on referrals for select to authenticated using (clinic_id = my_clinic());
create policy "families read their own referrals" on referrals for select to authenticated using (family_email is not null and lower(family_email) = lower(auth.jwt() ->> 'email'));

create policy "staff read state" on clinic_state for select to authenticated using (clinic_id = my_clinic());
create policy "admin and intake write state" on clinic_state for insert to authenticated with check (clinic_id = my_clinic() and my_role() in ('admin', 'intake'));
create policy "admin and intake update state" on clinic_state for update to authenticated using (clinic_id = my_clinic() and my_role() in ('admin', 'intake'));

create policy "staff read imports" on imports for select to authenticated using (clinic_id = my_clinic());
create policy "admin logs imports" on imports for insert to authenticated with check (clinic_id = my_clinic() and my_role() = 'admin');

create policy "staff read estimates" on estimates for select to authenticated using (clinic_id = my_clinic());
create policy "families read their own estimates" on estimates for select to authenticated using (is_my_referral(clinic_id, referral_id));

create policy "anyone signed in reads clinic summaries" on clinic_summary for select to authenticated using (true);

create policy "staff read notices" on notices for select to authenticated using (clinic_id = my_clinic());
create policy "families read their own notices" on notices for select to authenticated using (is_my_referral(clinic_id, referral_id));
create policy "admin and intake send notices" on notices for insert to authenticated with check (clinic_id = my_clinic() and my_role() in ('admin', 'intake'));

create policy "staff read family preferences" on family_prefs for select to authenticated using (clinic_id = my_clinic());
create policy "families read their preferences" on family_prefs for select to authenticated using (is_my_referral(clinic_id, referral_id));
create policy "families set their preferences" on family_prefs for insert to authenticated with check (is_my_referral(clinic_id, referral_id));
create policy "families change their preferences" on family_prefs for update to authenticated using (is_my_referral(clinic_id, referral_id));

create policy "admin reads the audit log" on audit_log for select to authenticated using (clinic_id = my_clinic() and my_role() = 'admin');
create policy "signed-in people add to the audit log" on audit_log for insert to authenticated
  with check (clinic_id is null or clinic_id = my_clinic() or (referral_id is not null and is_my_referral(clinic_id, referral_id)));

-- Live updates for open pages (the family's phone updates when staff change something).
alter publication supabase_realtime add table estimates, notices, clinic_state, clinic_summary;

-- ---------------------------------------------------------------- demo clinics and invited staff

insert into clinics (id, name) values
  ('maple-grove', 'Maple Grove Children''s Centre'),
  ('lakeshore', 'Lakeshore Rural Therapy Services'),
  ('riviere-est', 'Centre de réadaptation Rivière-Est');

insert into staff_invites (email, clinic_id, role, name) values
  ('admin@maplegrove.example', 'maple-grove', 'admin', 'Alex Rivera'),
  ('intake@maplegrove.example', 'maple-grove', 'intake', 'Jordan Lee'),
  ('manager@maplegrove.example', 'maple-grove', 'manager', 'Sam Patel'),
  ('admin@lakeshore.example', 'lakeshore', 'admin', 'Casey Morgan'),
  ('admin@riviere-est.example', 'riviere-est', 'admin', 'Camille Gagnon');

-- Link any of those accounts that already exist.
insert into staff_members (user_id, email, clinic_id, role, name)
select u.id, u.email, i.clinic_id, i.role, i.name from auth.users u join staff_invites i on lower(i.email) = lower(u.email)
on conflict (user_id) do nothing;
