-- 050_members_add_status.sql

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type member_status as enum ('active', 'left', 'rest', 'inactive', 'tobedeleted');
  end if;
end $$;

alter table public.members
  add column if not exists status member_status not null default 'active';

update public.members
set status = 'active'
where status is null;

create index if not exists members_status_idx on public.members(status);
