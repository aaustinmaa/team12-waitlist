-- Early Birds: hosted schema (Supabase / Postgres).
--
-- Mirrors the browser prototype (web/src/platform/store.tsx). Every table is
-- keyed by clinic, and row-level security keeps each clinic's staff to their
-- own clinic and each family to the referrals linked to their own email or
-- phone. Create the project in a Canadian region (ca-central-1).

create table clinics (
  id text primary key,
  name text not null,
  service text not null,
  contact text not null,
  phone text,
  hours text,
  address text,
  timezone text not null default 'America/Toronto',
  created_at timestamptz not null default now()
);

-- Clinic staff accounts are invite-only: an admin adds the person here after inviting them through Supabase Auth.
create type staff_role as enum ('admin', 'intake', 'manager');
create table staff_members (
  user_id uuid not null references auth.users on delete cascade,
  clinic_id text not null references clinics on delete cascade,
  role staff_role not null,
  name text not null,
  primary key (user_id, clinic_id)
);

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
create index referrals_family_phone on referrals (family_phone);

-- Staff changes on top of the imported data (priority with a reason, intake done, capacity scenario).
create table priority_changes (
  id bigint generated always as identity primary key,
  clinic_id text not null references clinics on delete cascade,
  referral_id text not null,
  from_priority text not null,
  to_priority text not null,
  reason text not null,
  by_user uuid references auth.users,
  at timestamptz not null default now()
);
create table clinic_settings (
  clinic_id text primary key references clinics on delete cascade,
  extra_slots integer not null default 0,
  data_as_of date
);

-- The saved mapping recipe per clinic (web/src/ingest/recipe.ts), and every import.
create table mapping_recipes (
  clinic_id text primary key references clinics on delete cascade,
  recipe jsonb not null,
  saved_by uuid references auth.users,
  saved_at timestamptz not null default now()
);
create table imports (
  id bigint generated always as identity primary key,
  clinic_id text not null references clinics on delete cascade,
  at timestamptz not null default now(),
  by_user uuid references auth.users,
  via text not null check (via in ('upload', 'sync')),
  file_name text not null,
  data_as_of date not null,
  rows integer not null,
  records integer not null,
  errors integer not null,
  warnings integer not null,
  diff jsonb
);

-- Estimates the engine computed after each import or staff change (what families see).
create table estimates (
  clinic_id text not null references clinics on delete cascade,
  referral_id text not null,
  as_of date not null,
  status text not null,
  lower_weeks integer,
  upper_weeks integer,
  reason text,
  family_visible boolean not null,
  primary key (clinic_id, referral_id),
  foreign key (clinic_id, referral_id) references referrals on delete cascade
);

-- Who looked at or changed what (PHIPA expects access to personal health information to be logged).
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  clinic_id text references clinics,
  actor uuid references auth.users,
  action text not null,
  detail text not null,
  referral_id text
);

-- ---------------------------------------------------------------- row-level security

alter table clinics enable row level security;
alter table staff_members enable row level security;
alter table referrals enable row level security;
alter table priority_changes enable row level security;
alter table clinic_settings enable row level security;
alter table mapping_recipes enable row level security;
alter table imports enable row level security;
alter table estimates enable row level security;
alter table audit_log enable row level security;

create function my_clinics() returns setof text language sql stable security definer as $$
  select clinic_id from staff_members where user_id = auth.uid()
$$;
create function my_role(c text) returns staff_role language sql stable security definer as $$
  select role from staff_members where user_id = auth.uid() and clinic_id = c
$$;

-- A family signed in by one-time code (email or SMS) matches on that email or phone.
create function is_my_referral(r referrals) returns boolean language sql stable as $$
  select (r.family_email is not null and lower(r.family_email) = lower(auth.jwt() ->> 'email'))
      or (r.family_phone is not null and regexp_replace(r.family_phone, '\D', '', 'g') like '%' || right(regexp_replace(coalesce(auth.jwt() ->> 'phone', 'x'), '\D', '', 'g'), 10))
$$;

create policy "staff read own clinic" on clinics for select using (id in (select my_clinics()));
create policy "families read clinics of their referrals" on clinics for select using (exists (select 1 from referrals r where r.clinic_id = clinics.id and is_my_referral(r)));
create policy "staff see own clinic's team" on staff_members for select using (clinic_id in (select my_clinics()));

create policy "staff read referrals" on referrals for select using (clinic_id in (select my_clinics()));
create policy "families read their own referrals" on referrals for select using (is_my_referral(referrals));
-- Imports write through the import function (service role), never directly from a browser.

create policy "staff read estimates" on estimates for select using (clinic_id in (select my_clinics()));
create policy "families read their own estimates" on estimates for select
  using (family_visible and exists (select 1 from referrals r where r.clinic_id = estimates.clinic_id and r.referral_id = estimates.referral_id and is_my_referral(r)));

create policy "staff read priority changes" on priority_changes for select using (clinic_id in (select my_clinics()));
create policy "intake and admin change priority" on priority_changes for insert
  with check (my_role(clinic_id) in ('admin', 'intake') and by_user = auth.uid() and length(reason) > 0);

create policy "staff read settings" on clinic_settings for select using (clinic_id in (select my_clinics()));
create policy "intake and admin set scenario" on clinic_settings for update using (my_role(clinic_id) in ('admin', 'intake'));

create policy "admin reads recipes" on mapping_recipes for select using (my_role(clinic_id) = 'admin');
create policy "staff read imports" on imports for select using (clinic_id in (select my_clinics()));
create policy "admin reads audit log" on audit_log for select using (my_role(clinic_id) = 'admin');
create policy "signed-in users append to audit log" on audit_log for insert with check (actor = auth.uid());
