-- BusinessOS Sprint 5: Product Master.
-- Review this migration before applying it in Supabase. It is not executed automatically.

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

create unique index product_categories_unique_active_name
  on public.product_categories (business_id, lower(btrim(name)))
  where not is_deleted;
create index product_categories_business_id_idx
  on public.product_categories (business_id);
create index product_categories_business_sort_idx
  on public.product_categories (business_id, sort_order, name)
  where not is_deleted;

create table public.units (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  abbreviation text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

create unique index units_unique_active_name
  on public.units (business_id, lower(btrim(name)))
  where not is_deleted;
create index units_business_id_idx
  on public.units (business_id);
create index units_business_name_idx
  on public.units (business_id, lower(name))
  where not is_deleted;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid references public.product_categories (id) on delete restrict,
  unit_id uuid references public.units (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  sku text,
  barcode text,
  description text,
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  track_stock boolean not null default true,
  low_stock_threshold numeric(14,3) not null default 0 check (low_stock_threshold >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

create unique index products_unique_active_sku
  on public.products (business_id, lower(btrim(sku)))
  where not is_deleted and sku is not null and btrim(sku) <> '';
create unique index products_unique_active_barcode
  on public.products (business_id, btrim(barcode))
  where not is_deleted and barcode is not null and btrim(barcode) <> '';
create index products_business_id_idx
  on public.products (business_id);
create index products_category_id_idx
  on public.products (business_id, category_id)
  where not is_deleted;
create index products_unit_id_idx
  on public.products (business_id, unit_id)
  where not is_deleted;
create index products_name_idx
  on public.products (business_id, lower(name))
  where not is_deleted;
create index products_sku_idx
  on public.products (business_id, lower(sku))
  where not is_deleted and sku is not null;
create index products_barcode_idx
  on public.products (business_id, barcode)
  where not is_deleted and barcode is not null;

-- Reuse the shared audit trigger function from migration 001.
create trigger product_categories_set_audit_fields
  before insert or update on public.product_categories
  for each row execute function public.set_audit_fields();
create trigger units_set_audit_fields
  before insert or update on public.units
  for each row execute function public.set_audit_fields();
create trigger products_set_audit_fields
  before insert or update on public.products
  for each row execute function public.set_audit_fields();

-- A product may reference only active master data owned by the same business.
create or replace function public.ensure_product_master_same_business()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1
    from public.product_categories category
    where category.id = new.category_id
      and category.business_id = new.business_id
      and not category.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Product category must belong to the same business';
  end if;

  if new.unit_id is not null and not exists (
    select 1
    from public.units unit_record
    where unit_record.id = new.unit_id
      and unit_record.business_id = new.business_id
      and not unit_record.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Product unit must belong to the same business';
  end if;

  return new;
end;
$$;

create trigger products_same_business_master_data
  before insert or update of business_id, category_id, unit_id on public.products
  for each row execute function public.ensure_product_master_same_business();

revoke all on function public.ensure_product_master_same_business() from public;

-- Prevent hiding master data while active products still reference it.
create or replace function public.prevent_soft_delete_used_product_master()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not new.is_deleted or old.is_deleted then
    return new;
  end if;

  if tg_table_name = 'product_categories' and exists (
    select 1
    from public.products product
    where product.business_id = old.business_id
      and product.category_id = old.id
      and not product.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Product category is still referenced by active products';
  end if;

  if tg_table_name = 'units' and exists (
    select 1
    from public.products product
    where product.business_id = old.business_id
      and product.unit_id = old.id
      and not product.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Product unit is still referenced by active products';
  end if;

  return new;
end;
$$;

create trigger product_categories_prevent_in_use_soft_delete
  before update of is_deleted on public.product_categories
  for each row execute function public.prevent_soft_delete_used_product_master();

create trigger units_prevent_in_use_soft_delete
  before update of is_deleted on public.units
  for each row execute function public.prevent_soft_delete_used_product_master();

revoke all on function public.prevent_soft_delete_used_product_master() from public;

-- Managers and owners may maintain product master data. Staff remain read-only.
create or replace function public.can_manage_business(target_business_id uuid)
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
      and membership.role in ('owner', 'manager')
      and membership.status = 'active'
      and not membership.is_deleted
  );
$$;

revoke all on function public.can_manage_business(uuid) from public;
grant execute on function public.can_manage_business(uuid) to authenticated;

alter table public.product_categories enable row level security;
alter table public.units enable row level security;
alter table public.products enable row level security;

create policy "Active members can view product categories"
  on public.product_categories for select
  using (not is_deleted and public.is_business_member(business_id));

create policy "Owners and managers can add product categories"
  on public.product_categories for insert
  with check (not is_deleted and public.can_manage_business(business_id));

create policy "Owners and managers can update product categories"
  on public.product_categories for update
  using (not is_deleted and public.can_manage_business(business_id))
  with check (public.can_manage_business(business_id));

create policy "Active members can view units"
  on public.units for select
  using (not is_deleted and public.is_business_member(business_id));

create policy "Owners and managers can add units"
  on public.units for insert
  with check (not is_deleted and public.can_manage_business(business_id));

create policy "Owners and managers can update units"
  on public.units for update
  using (not is_deleted and public.can_manage_business(business_id))
  with check (public.can_manage_business(business_id));

create policy "Active members can view products"
  on public.products for select
  using (not is_deleted and public.is_business_member(business_id));

create policy "Owners and managers can add products"
  on public.products for insert
  with check (not is_deleted and public.can_manage_business(business_id));

create policy "Owners and managers can update products"
  on public.products for update
  using (not is_deleted and public.can_manage_business(business_id))
  with check (public.can_manage_business(business_id));

-- Do not grant DELETE. Soft delete is performed through UPDATE and audited by set_audit_fields().
revoke all on table public.product_categories, public.units, public.products from anon;
grant select, insert, update on table public.product_categories, public.units, public.products to authenticated;
revoke delete on table public.product_categories, public.units, public.products from authenticated;
