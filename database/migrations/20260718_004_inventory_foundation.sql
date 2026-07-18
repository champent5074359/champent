-- BusinessOS Sprint 7A: branch-scoped inventory foundation.
-- Review this migration before applying it in Supabase. It is not executed automatically.
-- Sprint 7A supports only opening_balance, adjustment_in, adjustment_out, and
-- stock_count. Purchase, sale, and transfer movements will be enabled in Sprint 8.

create type public.inventory_movement_type as enum (
  'opening_balance',
  'adjustment_in',
  'adjustment_out',
  'purchase',
  'sale',
  'sale_return',
  'purchase_return',
  'transfer_in',
  'transfer_out',
  'stock_count'
);

-- Composite keys let branch-level inventory foreign keys prove that every
-- referenced branch and product belongs to the stated business.
create unique index branches_id_business_id_uidx
  on public.branches (id, business_id);
create unique index products_id_business_id_uidx
  on public.products (id, business_id);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  branch_id uuid not null,
  product_id uuid not null,
  quantity numeric(14,3) not null default 0,
  reserved_quantity numeric(14,3) not null default 0,
  -- TODO(Sprint 8 - Purchase Module): start calculating average_cost from purchases.
  average_cost numeric(14,2) not null default 0,
  last_movement_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint inventory_balances_branch_business_fkey
    foreign key (branch_id, business_id)
    references public.branches (id, business_id)
    on delete restrict,
  constraint inventory_balances_product_business_fkey
    foreign key (product_id, business_id)
    references public.products (id, business_id)
    on delete restrict,
  constraint inventory_balances_quantity_nonnegative
    check (quantity >= 0 and quantity <> 'NaN'::numeric),
  constraint inventory_balances_reserved_nonnegative
    check (reserved_quantity >= 0 and reserved_quantity <> 'NaN'::numeric),
  constraint inventory_balances_reserved_not_above_quantity
    check (reserved_quantity <= quantity),
  constraint inventory_balances_average_cost_nonnegative
    check (average_cost >= 0 and average_cost <> 'NaN'::numeric)
);

create unique index inventory_balances_unique_active
  on public.inventory_balances (business_id, branch_id, product_id)
  where not is_deleted;
create index inventory_balances_business_branch_idx
  on public.inventory_balances (business_id, branch_id)
  where not is_deleted;
create index inventory_balances_business_product_idx
  on public.inventory_balances (business_id, product_id)
  where not is_deleted;

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  branch_id uuid not null,
  product_id uuid not null,
  movement_type public.inventory_movement_type not null,
  quantity_change numeric(14,3) not null,
  quantity_before numeric(14,3) not null,
  quantity_after numeric(14,3) not null,
  unit_cost numeric(14,2),
  total_cost numeric(14,2),
  reference_type text,
  reference_id uuid,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint inventory_movements_branch_business_fkey
    foreign key (branch_id, business_id)
    references public.branches (id, business_id)
    on delete restrict,
  constraint inventory_movements_product_business_fkey
    foreign key (product_id, business_id)
    references public.products (id, business_id)
    on delete restrict,
  constraint inventory_movements_quantity_equation
    check (quantity_after = quantity_before + quantity_change),
  constraint inventory_movements_balances_nonnegative
    check (
      quantity_before >= 0
      and quantity_after >= 0
      and quantity_before <> 'NaN'::numeric
      and quantity_change <> 'NaN'::numeric
      and quantity_after <> 'NaN'::numeric
    ),
  constraint inventory_movements_costs_nonnegative
    check (
      (unit_cost is null or (unit_cost >= 0 and unit_cost <> 'NaN'::numeric))
      and (total_cost is null or (total_cost >= 0 and total_cost <> 'NaN'::numeric))
    ),
  constraint inventory_movements_type_sign
    check (
      (movement_type = 'opening_balance' and quantity_change >= 0)
      or (movement_type in ('adjustment_in', 'purchase', 'sale_return', 'transfer_in') and quantity_change > 0)
      or (movement_type in ('adjustment_out', 'sale', 'purchase_return', 'transfer_out') and quantity_change < 0)
      or movement_type = 'stock_count'
    )
);

create index inventory_movements_business_branch_time_idx
  on public.inventory_movements (business_id, branch_id, occurred_at desc)
  where not is_deleted;
create index inventory_movements_business_product_time_idx
  on public.inventory_movements (business_id, product_id, occurred_at desc)
  where not is_deleted;
create index inventory_movements_business_type_time_idx
  on public.inventory_movements (business_id, movement_type, occurred_at desc)
  where not is_deleted;

-- Keep privileged implementation details outside the exposed public schema.
create schema if not exists private;
revoke all on schema private from public;

-- Balances may reference only active branches and non-deleted products that
-- have inventory tracking enabled. Composite foreign keys enforce ownership.
create or replace function private.validate_inventory_balance_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.branches branch
    where branch.id = new.branch_id
      and branch.business_id = new.business_id
      and branch.is_active
      and not branch.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่พบสาขา';
  end if;

  if not exists (
    select 1
    from public.products product
    where product.id = new.product_id
      and product.business_id = new.business_id
      and not product.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่พบสินค้า';
  end if;

  if not exists (
    select 1
    from public.products product
    where product.id = new.product_id
      and product.business_id = new.business_id
      and product.track_stock
      and not product.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'สินค้านี้ไม่ได้เปิดติดตามสต๊อก';
  end if;

  return new;
end;
$$;

create trigger inventory_balances_validate_reference
  before insert or update
  on public.inventory_balances
  for each row execute function private.validate_inventory_balance_reference();

create trigger inventory_balances_set_audit_fields
  before insert or update on public.inventory_balances
  for each row execute function public.set_audit_fields();

-- Ledger rows are append-only. Corrections must be posted as compensating
-- movements instead of changing or deleting existing history.
create or replace function private.prevent_inventory_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'ประวัติการเคลื่อนไหวสต๊อกไม่สามารถแก้ไขหรือลบได้';
end;
$$;

create trigger inventory_movements_immutable
  before update or delete on public.inventory_movements
  for each row execute function private.prevent_inventory_movement_mutation();

-- The private implementation runs the balance update and ledger insert in one
-- database transaction. Any exception rolls the complete RPC call back.
create or replace function private.adjust_inventory(
  p_business_id uuid,
  p_branch_id uuid,
  p_product_id uuid,
  p_movement_type public.inventory_movement_type,
  p_quantity numeric,
  p_reason text,
  p_notes text default null
)
returns table (
  inventory_balance_id uuid,
  inventory_movement_id uuid,
  quantity_before numeric(14,3),
  quantity_change numeric(14,3),
  quantity_after numeric(14,3)
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance_id uuid;
  v_movement_id uuid;
  v_quantity_before numeric(14,3);
  v_quantity_change numeric(14,3);
  v_quantity_after numeric(14,3);
  v_reserved_quantity numeric(14,3);
  v_input_quantity numeric(14,3);
  v_occurred_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่มีสิทธิ์ปรับสต๊อก';
  end if;

  if not public.can_manage_business(p_business_id) then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่มีสิทธิ์ปรับสต๊อก';
  end if;

  if not exists (
    select 1
    from public.branches branch
    where branch.id = p_branch_id
      and branch.business_id = p_business_id
      and branch.is_active
      and not branch.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่พบสาขา';
  end if;

  if not public.has_branch_access(p_branch_id) then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่มีสิทธิ์ปรับสต๊อก';
  end if;

  if not exists (
    select 1
    from public.products product
    where product.id = p_product_id
      and product.business_id = p_business_id
      and not product.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่พบสินค้า';
  end if;

  if not exists (
    select 1
    from public.products product
    where product.id = p_product_id
      and product.business_id = p_business_id
      and product.track_stock
      and not product.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'สินค้านี้ไม่ได้เปิดติดตามสต๊อก';
  end if;

  if p_quantity is null
    or p_quantity = 'NaN'::numeric
    or p_movement_type is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'จำนวนไม่ถูกต้อง';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception using
      errcode = 'P0001',
      message = 'กรุณาระบุเหตุผล';
  end if;

  if p_movement_type not in (
    'opening_balance'::public.inventory_movement_type,
    'adjustment_in'::public.inventory_movement_type,
    'adjustment_out'::public.inventory_movement_type,
    'stock_count'::public.inventory_movement_type
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ประเภทการเคลื่อนไหวสต๊อกยังไม่เปิดใช้งาน';
  end if;

  if p_movement_type in (
    'opening_balance'::public.inventory_movement_type,
    'stock_count'::public.inventory_movement_type
  ) and p_quantity < 0 then
    raise exception using
      errcode = 'P0001',
      message = 'จำนวนไม่ถูกต้อง';
  end if;

  if p_movement_type in (
    'adjustment_in'::public.inventory_movement_type,
    'adjustment_out'::public.inventory_movement_type
  ) and p_quantity <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'จำนวนไม่ถูกต้อง';
  end if;

  v_input_quantity := p_quantity;

  -- Reject positive values that round to zero at the supported 3 decimals.
  if p_movement_type in (
    'adjustment_in'::public.inventory_movement_type,
    'adjustment_out'::public.inventory_movement_type
  ) and v_input_quantity <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'จำนวนไม่ถูกต้อง';
  end if;

  -- The partial unique index and ON CONFLICT serialize concurrent first use.
  insert into public.inventory_balances (
    business_id,
    branch_id,
    product_id,
    quantity,
    reserved_quantity,
    average_cost,
    created_by,
    updated_by
  )
  values (
    p_business_id,
    p_branch_id,
    p_product_id,
    0,
    0,
    0,
    v_user_id,
    v_user_id
  )
  on conflict (business_id, branch_id, product_id)
    where not is_deleted
    do nothing;

  select balance.id, balance.quantity, balance.reserved_quantity
    into v_balance_id, v_quantity_before, v_reserved_quantity
  from public.inventory_balances balance
  where balance.business_id = p_business_id
    and balance.branch_id = p_branch_id
    and balance.product_id = p_product_id
    and not balance.is_deleted
  for update;

  if v_balance_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่สามารถบันทึกการปรับสต๊อกได้';
  end if;

  if p_movement_type = 'opening_balance'::public.inventory_movement_type then
    if exists (
      select 1
      from public.inventory_movements movement
      where movement.business_id = p_business_id
        and movement.branch_id = p_branch_id
        and movement.product_id = p_product_id
        and movement.movement_type = 'opening_balance'::public.inventory_movement_type
        and not movement.is_deleted
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'ไม่สามารถกำหนดยอดตั้งต้นซ้ำได้';
    end if;

    v_quantity_change := v_input_quantity;
    v_quantity_after := v_input_quantity;
  elsif p_movement_type = 'adjustment_in'::public.inventory_movement_type then
    v_quantity_change := v_input_quantity;
    v_quantity_after := v_quantity_before + v_quantity_change;
  elsif p_movement_type = 'adjustment_out'::public.inventory_movement_type then
    v_quantity_change := -v_input_quantity;
    v_quantity_after := v_quantity_before + v_quantity_change;
  else
    -- stock_count receives the physical quantity after counting.
    v_quantity_after := v_input_quantity;
    v_quantity_change := v_quantity_after - v_quantity_before;
  end if;

  if v_quantity_after < 0 then
    raise exception using
      errcode = 'P0001',
      message = 'สต๊อกคงเหลือไม่เพียงพอ ไม่สามารถปรับยอดให้ติดลบได้';
  end if;

  if v_reserved_quantity > v_quantity_after then
    raise exception using
      errcode = 'P0001',
      message = 'สต๊อกคงเหลือหลังปรับต้องไม่น้อยกว่ายอดจอง';
  end if;

  update public.inventory_balances
  set quantity = v_quantity_after,
      last_movement_at = v_occurred_at,
      updated_by = v_user_id
  where id = v_balance_id;

  insert into public.inventory_movements (
    business_id,
    branch_id,
    product_id,
    movement_type,
    quantity_change,
    quantity_before,
    quantity_after,
    reason,
    notes,
    occurred_at,
    created_by
  )
  values (
    p_business_id,
    p_branch_id,
    p_product_id,
    p_movement_type,
    v_quantity_change,
    v_quantity_before,
    v_quantity_after,
    btrim(p_reason),
    nullif(btrim(p_notes), ''),
    v_occurred_at,
    v_user_id
  )
  returning id into v_movement_id;

  return query
    select
      v_balance_id,
      v_movement_id,
      v_quantity_before,
      v_quantity_change,
      v_quantity_after;
end;
$$;

-- PostgREST exposes only this invoker wrapper. It accepts one user-entered
-- quantity and never accepts quantity_before or quantity_after.
create or replace function public.adjust_inventory(
  p_business_id uuid,
  p_branch_id uuid,
  p_product_id uuid,
  p_movement_type public.inventory_movement_type,
  p_quantity numeric,
  p_reason text,
  p_notes text default null
)
returns table (
  inventory_balance_id uuid,
  inventory_movement_id uuid,
  quantity_before numeric(14,3),
  quantity_change numeric(14,3),
  quantity_after numeric(14,3)
)
language sql
security invoker
set search_path = ''
as $$
  select result.inventory_balance_id,
         result.inventory_movement_id,
         result.quantity_before,
         result.quantity_change,
         result.quantity_after
  from private.adjust_inventory(
    p_business_id,
    p_branch_id,
    p_product_id,
    p_movement_type,
    p_quantity,
    p_reason,
    p_notes
  ) as result;
$$;

alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;

create policy "Authorized members can view inventory balances"
  on public.inventory_balances
  for select
  to authenticated
  using (
    not is_deleted
    and public.is_business_member(business_id)
    and public.has_branch_access(branch_id)
  );

create policy "Authorized members can view inventory movements"
  on public.inventory_movements
  for select
  to authenticated
  using (
    not is_deleted
    and public.is_business_member(business_id)
    and public.has_branch_access(branch_id)
  );

-- Client roles can read authorized rows only. There are intentionally no
-- INSERT, UPDATE, or DELETE policies for either inventory table.
revoke all on table public.inventory_balances, public.inventory_movements from public, anon, authenticated;
grant select on table public.inventory_balances, public.inventory_movements to authenticated;

revoke all on type public.inventory_movement_type from public, anon, authenticated;
grant usage on type public.inventory_movement_type to authenticated;

-- Trigger helpers are internal-only.
revoke all on function private.validate_inventory_balance_reference() from public, anon, authenticated;
revoke all on function private.prevent_inventory_movement_mutation() from public, anon, authenticated;

-- The public wrapper may call the private implementation, but the private
-- schema remains outside the Data API exposed schemas.
grant usage on schema private to authenticated;
revoke all on function private.adjust_inventory(
  uuid,
  uuid,
  uuid,
  public.inventory_movement_type,
  numeric,
  text,
  text
) from public, anon, authenticated;
grant execute on function private.adjust_inventory(
  uuid,
  uuid,
  uuid,
  public.inventory_movement_type,
  numeric,
  text,
  text
) to authenticated;

revoke all on function public.adjust_inventory(
  uuid,
  uuid,
  uuid,
  public.inventory_movement_type,
  numeric,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.adjust_inventory(
  uuid,
  uuid,
  uuid,
  public.inventory_movement_type,
  numeric,
  text,
  text
) to authenticated;
