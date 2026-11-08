-- Keep anonymous product feedback after an account and its journal are deleted.
create table if not exists public.account_deletion_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  reason text not null check (reason in ('not-using', 'missing-features', 'broker-connection', 'difficult-to-use', 'switching', 'privacy', 'other')),
  details text,
  created_at timestamptz not null default now()
);

alter table public.account_deletion_feedback enable row level security;
revoke all on table public.account_deletion_feedback from anon, authenticated;
grant insert on table public.account_deletion_feedback to service_role;
grant usage, select on sequence public.account_deletion_feedback_id_seq to service_role;
