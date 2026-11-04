-- One private JSON document per authenticated journal owner.
create table if not exists public.user_journals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_journals enable row level security;

revoke all on table public.user_journals from anon, authenticated;
grant select, insert, update, delete on table public.user_journals to authenticated;

drop policy if exists "Users can read their own journal" on public.user_journals;
create policy "Users can read their own journal"
  on public.user_journals for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own journal" on public.user_journals;
create policy "Users can create their own journal"
  on public.user_journals for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own journal" on public.user_journals;
create policy "Users can update their own journal"
  on public.user_journals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own journal" on public.user_journals;
create policy "Users can delete their own journal"
  on public.user_journals for delete to authenticated
  using ((select auth.uid()) = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'user_journals'
    ) then
    alter publication supabase_realtime add table public.user_journals;
  end if;
end
$$;
