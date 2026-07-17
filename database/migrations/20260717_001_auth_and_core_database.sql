-- BusinessOS Sprint 4: authentication-linked organization foundation.
-- This file is intentionally not executed automatically. Review it before applying in Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.business_role as enum ('owner', 'manager', 'staff');
create type public.member_status as enum ('invited', 'active', 'suspended', 'removed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text unique,
  phone text,
  avatar_url text,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  locale text not null default 'th',
  preferred_language text not null default 'th',
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  business_type text not null check (business_type in ('food', 'fashion', 'retail', 'service', 'manufacturing', 'warehouse', 'other')),
  owner_name text,
  phone text,
  email text,
  country text not null default 'Thailand',
  province text,
  tax_id text,
  currency_code char(3) not null default 'THB',
  timezone text not null default 'Asia/Bangkok',
  logo_url text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.business_role not null default 'staff',
  is_primary_owner boolean not null default false,
  status public.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_primary_owner or role = 'owner')
);

create unique index business_members_unique_active_membership
  on public.business_members (business_id, profile_id)
  where not is_deleted;

create unique index business_members_one_primary_owner
  on public.business_members (business_id)
  where is_primary_owner and status = 'active' and not is_deleted;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  code text not null check (char_length(trim(code)) between 1 and 40),
  address text,
  phone text,
  latitude numeric,
  longitude numeric,
  is_headquarters boolean not null default false,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create unique index branches_unique_active_code
  on public.branches (business_id, code)
  where not is_deleted;

create table public.branch_members (
  id uuid primary key default gen_random_uuid(),
  business_member_id uuid not null references public.business_members (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  is_default boolean not null default false,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index branch_members_unique_active_assignment
  on public.branch_members (business_member_id, branch_id)
  where not is_deleted;

create unique index branch_members_one_default_branch
  on public.branch_members (business_member_id)
  where is_default and not is_deleted;

create index business_members_profile_id_idx on public.business_members (profile_id);
create index business_members_business_id_idx on public.business_members (business_id);
create index branches_business_id_idx on public.branches (business_id);
create index branch_members_branch_id_idx on public.branch_members (branch_id);

create or replace function public.set_audit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, new.created_by, auth.uid());
  else
    new.updated_at = now();
    new.updated_by = coalesce(auth.uid(), new.updated_by, old.updated_by);
  end if;

  if new.is_deleted then
    if tg_op = 'INSERT' then
      new.deleted_at = coalesce(new.deleted_at, now());
      new.deleted_by = coalesce(auth.uid(), new.deleted_by);
    elsif not old.is_deleted then
      new.deleted_at = coalesce(new.deleted_at, now());
      new.deleted_by = coalesce(auth.uid(), new.deleted_by, old.deleted_by);
    end if;
  else
    new.deleted_at = null;
    new.deleted_by = null;
  end if;

  return new;
end;
$$;

create trigger profiles_set_audit_fields before insert or update on public.profiles
  for each row execute function public.set_audit_fields();
create trigger businesses_set_audit_fields before insert or update on public.businesses
  for each row execute function public.set_audit_fields();
create trigger business_members_set_audit_fields before insert or update on public.business_members
  for each row execute function public.set_audit_fields();
create trigger branches_set_audit_fields before insert or update on public.branches
  for each row execute function public.set_audit_fields();
create trigger branch_members_set_audit_fields before insert or update on public.branch_members
  for each row execute function public.set_audit_fields();

-- Creates the public profile for every new Supabase Auth user.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, created_by, updated_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.id,
    new.id
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Prevents a branch assignment from linking a member to another business.
create or replace function public.ensure_branch_member_same_business()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  member_business_id uuid;
  branch_business_id uuid;
begin
  select business_id into member_business_id from public.business_members where id = new.business_member_id;
  select business_id into branch_business_id from public.branches where id = new.branch_id;

  if member_business_id is distinct from branch_business_id then
    raise exception 'Branch membership must belong to the same business';
  end if;

  return new;
end;
$$;

create trigger branch_members_same_business
  before insert or update on public.branch_members
  for each row execute function public.ensure_branch_member_same_business();

-- RLS helper functions use the caller's Auth user id but bypass table RLS to avoid policy recursion.
create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members membership
    where membership.business_id = target_business_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
      and not membership.is_deleted
  );
$$;

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members membership
    where membership.business_id = target_business_id
      and membership.profile_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
      and not membership.is_deleted
  );
$$;

create or replace function public.has_branch_access(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.branches branch
    where branch.id = target_branch_id
      and not branch.is_deleted
      and public.is_business_owner(branch.business_id)
  )
  or exists (
    select 1
    from public.branch_members assignment
    join public.business_members membership on membership.id = assignment.business_member_id
    where assignment.branch_id = target_branch_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
      and not assignment.is_deleted
      and not membership.is_deleted
  );
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.branches enable row level security;
alter table public.branch_members enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (id = auth.uid() and not is_deleted);

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid() and not is_deleted)
  with check (id = auth.uid());

create policy "Members can view their businesses"
  on public.businesses for select
  using (not is_deleted and public.is_business_member(id));

create policy "Owners can update their businesses"
  on public.businesses for update
  using (not is_deleted and public.is_business_owner(id))
  with check (public.is_business_owner(id));

create policy "Members can view business members"
  on public.business_members for select
  using (not is_deleted and public.is_business_member(business_id));

create policy "Owners can add business members"
  on public.business_members for insert
  with check (not is_deleted and public.is_business_owner(business_id));

create policy "Owners can update business members"
  on public.business_members for update
  using (not is_deleted and public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy "Owners can remove business members"
  on public.business_members for delete
  using (not is_deleted and public.is_business_owner(business_id));

create policy "Authorized users can view permitted branches"
  on public.branches for select
  using (not is_deleted and public.has_branch_access(id));

create policy "Owners can add branches"
  on public.branches for insert
  with check (not is_deleted and public.is_business_owner(business_id));

create policy "Owners can update branches"
  on public.branches for update
  using (not is_deleted and public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy "Owners can remove branches"
  on public.branches for delete
  using (not is_deleted and public.is_business_owner(business_id));

create policy "Members can view their branch assignments"
  on public.branch_members for select
  using (not is_deleted and (
    exists (
      select 1 from public.business_members membership
      where membership.id = branch_members.business_member_id
        and membership.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.branches branch
      where branch.id = branch_members.branch_id
        and public.is_business_owner(branch.business_id)
    )
  ));

create policy "Owners can add branch assignments"
  on public.branch_members for insert
  with check (not is_deleted and (
    exists (
      select 1 from public.branches branch
      where branch.id = branch_members.branch_id
        and public.is_business_owner(branch.business_id)
    )
  ));

create policy "Owners can update branch assignments"
  on public.branch_members for update
  using (not is_deleted and (
    exists (
      select 1 from public.branches branch
      where branch.id = branch_members.branch_id
        and public.is_business_owner(branch.business_id)
    )
  ))
  with check (
    exists (
      select 1 from public.branches branch
      where branch.id = branch_members.branch_id
        and public.is_business_owner(branch.business_id)
    )
  );

create policy "Owners can remove branch assignments"
  on public.branch_members for delete
  using (not is_deleted and (
    exists (
      select 1 from public.branches branch
      where branch.id = branch_members.branch_id
        and public.is_business_owner(branch.business_id)
    )
  ));

-- Atomically creates a business, its first owner membership, its first branch, and access to that branch.
create or replace function public.create_business_with_owner(
  p_business_name text,
  p_business_type text,
  p_branch_name text
)
returns table (business_id uuid, branch_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  new_business_id uuid;
  new_branch_id uuid;
  new_member_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication is required';
  end if;

  if coalesce(trim(p_business_name), '') = '' or coalesce(trim(p_branch_name), '') = '' then
    raise exception 'Business and branch names are required';
  end if;

  if p_business_type not in ('food', 'fashion', 'retail', 'service', 'manufacturing', 'warehouse', 'other') then
    raise exception 'Invalid business type';
  end if;

  -- Supports existing Auth users if this migration is applied after they registered.
  insert into public.profiles (id, full_name, email)
  select id, coalesce(raw_user_meta_data ->> 'full_name', ''), email
  from auth.users
  where id = current_profile_id
  on conflict (id) do nothing;

  insert into public.businesses (name, business_type, owner_name, email)
  select trim(p_business_name), p_business_type, profile.full_name, profile.email
  from public.profiles profile
  where profile.id = current_profile_id
  returning id into new_business_id;

  insert into public.business_members (business_id, profile_id, role, is_primary_owner, status)
  values (new_business_id, current_profile_id, 'owner', true, 'active')
  returning id into new_member_id;

  insert into public.branches (business_id, name, code, is_headquarters)
  values (new_business_id, trim(p_branch_name), 'MAIN', true)
  returning id into new_branch_id;

  insert into public.branch_members (business_member_id, branch_id, is_default)
  values (new_member_id, new_branch_id, true);

  return query select new_business_id, new_branch_id;
end;
$$;

revoke all on function public.create_business_with_owner(text, text, text) from public;
grant execute on function public.create_business_with_owner(text, text, text) to authenticated;
