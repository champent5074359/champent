-- BusinessOS Sprint 8A: Purchase Foundation.
-- Review this migration before applying it in Supabase. It is not executed automatically.
-- Average cost is intentionally not calculated in Sprint 8A. Purchase movements
-- retain the cost inputs required for the weighted-average implementation in Sprint 8B.

begin;

do $migration$
begin
  if to_regtype('public.purchase_receipt_status') is null then
    execute $enum$
      create type public.purchase_receipt_status as enum (
        'draft',
        'received',
        'cancelled'
      )
    $enum$;
  end if;
end;
$migration$;

-- A branch may override its purchase prefix without changing its operational code.
-- Existing receipts keep their own prefix snapshot, so later changes affect only
-- newly-created document numbers.
alter table public.branches
  add column if not exists purchase_receipt_prefix text;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.branches'::regclass
      and conname = 'branches_purchase_receipt_prefix_format'
  ) then
    alter table public.branches
      add constraint branches_purchase_receipt_prefix_format
      check (
        purchase_receipt_prefix is null
        or btrim(purchase_receipt_prefix) ~ '^[A-Za-z0-9]{1,12}$'
      );
  end if;
end;
$migration$;

create unique index if not exists branches_unique_active_purchase_receipt_prefix
  on public.branches (
    business_id,
    upper(btrim(coalesce(purchase_receipt_prefix, code)))
  )
  where not is_deleted;

-- Composite keys prove tenant ownership in all purchase foreign keys.
create unique index if not exists branches_id_business_id_uidx
  on public.branches (id, business_id);
create unique index if not exists products_id_business_id_uidx
  on public.products (id, business_id);
create unique index if not exists units_id_business_id_uidx
  on public.units (id, business_id);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  code text,
  name text not null,
  tax_id text,
  contact_name text,
  phone text,
  email text,
  address text,
  payment_terms_days integer not null default 0,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint suppliers_name_length
    check (char_length(btrim(name)) between 1 and 200),
  constraint suppliers_code_length
    check (code is null or char_length(btrim(code)) between 1 and 50),
  constraint suppliers_tax_id_length
    check (tax_id is null or char_length(btrim(tax_id)) between 1 and 50),
  constraint suppliers_contact_name_length
    check (contact_name is null or char_length(btrim(contact_name)) between 1 and 200),
  constraint suppliers_phone_length
    check (phone is null or char_length(btrim(phone)) between 1 and 50),
  constraint suppliers_email_length
    check (email is null or char_length(btrim(email)) between 1 and 320),
  constraint suppliers_payment_terms_nonnegative
    check (payment_terms_days >= 0)
);

create unique index if not exists suppliers_id_business_id_uidx
  on public.suppliers (id, business_id);
create unique index if not exists suppliers_unique_active_name
  on public.suppliers (business_id, lower(btrim(name)))
  where not is_deleted;
create unique index if not exists suppliers_unique_active_code
  on public.suppliers (business_id, lower(btrim(code)))
  where not is_deleted and code is not null and btrim(code) <> '';
create unique index if not exists suppliers_unique_active_tax_id
  on public.suppliers (business_id, lower(btrim(tax_id)))
  where not is_deleted and tax_id is not null and btrim(tax_id) <> '';
create index if not exists suppliers_business_active_name_idx
  on public.suppliers (business_id, is_active, lower(name))
  where not is_deleted;

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  branch_id uuid not null,
  supplier_id uuid,
  document_prefix text not null,
  document_no text not null,
  receipt_date date not null default current_date,
  status public.purchase_receipt_status not null default 'draft',
  currency_code text not null,
  exchange_rate numeric(18,6) not null default 1,
  invoice_number text,
  reference text,
  supplier_name_snapshot text,
  supplier_tax_id_snapshot text,
  subtotal_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  notes text,
  received_at timestamptz,
  received_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint purchase_receipts_branch_business_fkey
    foreign key (branch_id, business_id)
    references public.branches (id, business_id)
    on delete restrict,
  constraint purchase_receipts_supplier_business_fkey
    foreign key (supplier_id, business_id)
    references public.suppliers (id, business_id)
    on delete restrict,
  constraint purchase_receipts_id_business_branch_unique
    unique (id, business_id, branch_id),
  constraint purchase_receipts_id_business_unique
    unique (id, business_id),
  constraint purchase_receipts_document_prefix_format
    check (document_prefix ~ '^[A-Z0-9]{1,12}$'),
  constraint purchase_receipts_document_no_length
    check (char_length(btrim(document_no)) between 1 and 80),
  constraint purchase_receipts_currency_code_format
    check (currency_code ~ '^[A-Z]{3}$'),
  constraint purchase_receipts_exchange_rate_positive
    check (exchange_rate > 0 and exchange_rate <> 'NaN'::numeric),
  constraint purchase_receipts_invoice_number_length
    check (invoice_number is null or char_length(btrim(invoice_number)) between 1 and 100),
  constraint purchase_receipts_reference_length
    check (reference is null or char_length(btrim(reference)) between 1 and 200),
  constraint purchase_receipts_amounts_nonnegative
    check (
      subtotal_amount >= 0
      and discount_amount >= 0
      and total_amount >= 0
      and subtotal_amount <> 'NaN'::numeric
      and discount_amount <> 'NaN'::numeric
      and total_amount <> 'NaN'::numeric
    ),
  constraint purchase_receipts_total_equation
    check (total_amount = subtotal_amount - discount_amount),
  constraint purchase_receipts_state_fields
    check (
      (
        status = 'draft'
        and supplier_name_snapshot is null
        and supplier_tax_id_snapshot is null
        and received_at is null
        and received_by is null
        and cancelled_at is null
        and cancelled_by is null
        and cancellation_reason is null
      )
      or (
        status = 'received'
        and received_at is not null
        and received_by is not null
        and supplier_name_snapshot is not null
        and cancelled_at is null
        and cancelled_by is null
        and cancellation_reason is null
      )
      or (
        status = 'cancelled'
        and received_at is not null
        and received_by is not null
        and supplier_name_snapshot is not null
        and cancelled_at is not null
        and cancelled_by is not null
        and char_length(btrim(cancellation_reason)) between 1 and 500
      )
    ),
  constraint purchase_receipts_soft_delete_draft_only
    check (not is_deleted or status = 'draft')
);

create unique index if not exists purchase_receipts_unique_document_no
  on public.purchase_receipts (business_id, document_no);
create index if not exists purchase_receipts_business_status_date_idx
  on public.purchase_receipts (business_id, status, receipt_date desc, created_at desc)
  where not is_deleted;
create index if not exists purchase_receipts_business_branch_date_idx
  on public.purchase_receipts (business_id, branch_id, receipt_date desc)
  where not is_deleted;
create index if not exists purchase_receipts_business_supplier_date_idx
  on public.purchase_receipts (business_id, supplier_id, receipt_date desc)
  where not is_deleted and supplier_id is not null;
create index if not exists purchase_receipts_invoice_number_idx
  on public.purchase_receipts (business_id, lower(btrim(invoice_number)))
  where not is_deleted and invoice_number is not null;

create table if not exists public.purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  purchase_receipt_id uuid not null,
  business_id uuid not null,
  branch_id uuid not null,
  line_no integer not null,
  product_id uuid not null,
  unit_id uuid,
  product_name_snapshot text not null,
  sku_snapshot text,
  unit_name_snapshot text,
  unit_abbreviation_snapshot text,
  quantity numeric(14,3) not null,
  unit_cost numeric(14,2) not null,
  line_discount numeric(14,2) not null default 0,
  gross_amount numeric(14,2)
    generated always as (round(quantity * unit_cost, 2)) stored,
  net_amount numeric(14,2)
    generated always as (round(quantity * unit_cost, 2) - line_discount) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint purchase_receipt_items_receipt_business_fkey
    foreign key (purchase_receipt_id, business_id)
    references public.purchase_receipts (id, business_id)
    on delete restrict,
  constraint purchase_receipt_items_product_business_fkey
    foreign key (product_id, business_id)
    references public.products (id, business_id)
    on delete restrict,
  constraint purchase_receipt_items_unit_business_fkey
    foreign key (unit_id, business_id)
    references public.units (id, business_id)
    on delete restrict,
  constraint purchase_receipt_items_line_no_positive
    check (line_no > 0),
  constraint purchase_receipt_items_quantity_positive
    check (quantity > 0 and quantity <> 'NaN'::numeric),
  constraint purchase_receipt_items_cost_nonnegative
    check (unit_cost >= 0 and unit_cost <> 'NaN'::numeric),
  constraint purchase_receipt_items_discount_valid
    check (
      line_discount >= 0
      and line_discount <> 'NaN'::numeric
      and line_discount <= round(quantity * unit_cost, 2)
    ),
  constraint purchase_receipt_items_product_name_length
    check (char_length(btrim(product_name_snapshot)) between 1 and 200)
);

create unique index if not exists purchase_receipt_items_unique_active_line
  on public.purchase_receipt_items (purchase_receipt_id, line_no)
  where not is_deleted;
create unique index if not exists purchase_receipt_items_unique_active_product
  on public.purchase_receipt_items (purchase_receipt_id, product_id)
  where not is_deleted;
create index if not exists purchase_receipt_items_business_receipt_idx
  on public.purchase_receipt_items (business_id, purchase_receipt_id)
  where not is_deleted;
create index if not exists purchase_receipt_items_business_product_idx
  on public.purchase_receipt_items (business_id, product_id)
  where not is_deleted;

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.purchase_receipt_number_counters (
  business_id uuid not null references public.businesses (id) on delete restrict,
  branch_id uuid not null,
  document_prefix text not null,
  period_key text not null,
  last_value bigint not null,
  updated_at timestamptz not null default now(),
  primary key (business_id, branch_id, document_prefix, period_key),
  constraint purchase_receipt_number_counters_branch_business_fkey
    foreign key (branch_id, business_id)
    references public.branches (id, business_id)
    on delete restrict,
  constraint purchase_receipt_number_counters_prefix_format
    check (document_prefix ~ '^[A-Z0-9]{1,12}$'),
  constraint purchase_receipt_number_counters_period_format
    check (period_key ~ '^[0-9]{6}$'),
  constraint purchase_receipt_number_counters_last_value_positive
    check (last_value > 0)
);

create index if not exists purchase_receipt_number_counters_branch_idx
  on private.purchase_receipt_number_counters (branch_id, business_id);

alter table private.purchase_receipt_number_counters enable row level security;

-- One purchase and one compensating purchase_return are allowed for each item.
-- Inventory history remains immutable; cancellation never deletes the purchase.
create unique index if not exists inventory_movements_purchase_reference_uidx
  on public.inventory_movements (reference_type, reference_id, movement_type)
  where reference_type = 'purchase_receipt_item'
    and reference_id is not null
    and (
      movement_type = 'purchase'::public.inventory_movement_type
      or movement_type = 'purchase_return'::public.inventory_movement_type
    )
    and not is_deleted;

create or replace function private.normalize_purchase_receipt_prefix()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.purchase_receipt_prefix := nullif(upper(btrim(new.purchase_receipt_prefix)), '');
  return new;
end;
$$;

drop trigger if exists branches_normalize_purchase_receipt_prefix
  on public.branches;
create trigger branches_normalize_purchase_receipt_prefix
  before insert or update of purchase_receipt_prefix on public.branches
  for each row execute function private.normalize_purchase_receipt_prefix();

create or replace function private.prevent_supplier_business_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่สามารถย้ายผู้จำหน่ายไปยังธุรกิจอื่นได้';
  end if;

  return new;
end;
$$;

drop trigger if exists suppliers_prevent_business_change
  on public.suppliers;
create trigger suppliers_prevent_business_change
  before update on public.suppliers
  for each row execute function private.prevent_supplier_business_change();

drop trigger if exists suppliers_set_audit_fields
  on public.suppliers;
create trigger suppliers_set_audit_fields
  before insert or update on public.suppliers
  for each row execute function public.set_audit_fields();

create or replace function private.guard_purchase_receipt_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft'::public.purchase_receipt_status or new.is_deleted then
      raise exception using
        errcode = 'P0001',
        message = 'เอกสารใหม่ต้องเริ่มต้นเป็นฉบับร่าง';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.business_id is distinct from old.business_id
    or new.document_prefix is distinct from old.document_prefix
    or new.document_no is distinct from old.document_no
    or new.created_at is distinct from old.created_at
    or new.created_by is distinct from old.created_by
  then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่สามารถเปลี่ยนข้อมูลอ้างอิงหลักของเอกสารรับสินค้าได้';
  end if;

  if old.is_deleted then
    raise exception using
      errcode = 'P0001',
      message = 'เอกสารฉบับร่างนี้ถูกลบแล้ว';
  end if;

  if old.status = 'draft'::public.purchase_receipt_status then
    if new.status = 'draft'::public.purchase_receipt_status then
      return new;
    end if;

    if new.status = 'received'::public.purchase_receipt_status and not new.is_deleted then
      return new;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'สถานะเอกสารรับสินค้าไม่ถูกต้อง';
  end if;

  if old.status = 'received'::public.purchase_receipt_status then
    if new.status <> 'cancelled'::public.purchase_receipt_status
      or new.is_deleted
      or new.branch_id is distinct from old.branch_id
      or new.supplier_id is distinct from old.supplier_id
      or new.receipt_date is distinct from old.receipt_date
      or new.currency_code is distinct from old.currency_code
      or new.exchange_rate is distinct from old.exchange_rate
      or new.invoice_number is distinct from old.invoice_number
      or new.reference is distinct from old.reference
      or new.supplier_name_snapshot is distinct from old.supplier_name_snapshot
      or new.supplier_tax_id_snapshot is distinct from old.supplier_tax_id_snapshot
      or new.subtotal_amount is distinct from old.subtotal_amount
      or new.discount_amount is distinct from old.discount_amount
      or new.total_amount is distinct from old.total_amount
      or new.notes is distinct from old.notes
      or new.received_at is distinct from old.received_at
      or new.received_by is distinct from old.received_by
    then
      raise exception using
        errcode = 'P0001',
        message = 'เอกสารที่รับสินค้าแล้วแก้ไขไม่ได้ กรุณายกเลิกและสร้างเอกสารใหม่';
    end if;

    return new;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'เอกสารที่ยกเลิกแล้วไม่สามารถแก้ไขได้';
end;
$$;

drop trigger if exists purchase_receipts_guard_mutation
  on public.purchase_receipts;
create trigger purchase_receipts_guard_mutation
  before insert or update on public.purchase_receipts
  for each row execute function private.guard_purchase_receipt_mutation();

drop trigger if exists purchase_receipts_set_audit_fields
  on public.purchase_receipts;
create trigger purchase_receipts_set_audit_fields
  before insert or update on public.purchase_receipts
  for each row execute function public.set_audit_fields();

create or replace function private.guard_purchase_receipt_item_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_receipt_id uuid := coalesce(new.purchase_receipt_id, old.purchase_receipt_id);
  v_business_id uuid := coalesce(new.business_id, old.business_id);
  v_branch_id uuid := coalesce(new.branch_id, old.branch_id);
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.purchase_receipt_id is distinct from old.purchase_receipt_id
    or new.business_id is distinct from old.business_id
    or new.branch_id is distinct from old.branch_id
    or new.created_at is distinct from old.created_at
    or new.created_by is distinct from old.created_by
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ไม่สามารถย้ายรายการสินค้าไปยังเอกสารอื่นได้';
  end if;

  if not exists (
    select 1
    from public.purchase_receipts receipt
    where receipt.id = v_receipt_id
      and receipt.business_id = v_business_id
      and receipt.branch_id = v_branch_id
      and receipt.status = 'draft'::public.purchase_receipt_status
      and not receipt.is_deleted
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'รายการสินค้าแก้ไขได้เฉพาะเอกสารฉบับร่าง';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_receipt_items_guard_mutation
  on public.purchase_receipt_items;
create trigger purchase_receipt_items_guard_mutation
  before insert or update or delete on public.purchase_receipt_items
  for each row execute function private.guard_purchase_receipt_item_mutation();

drop trigger if exists purchase_receipt_items_set_audit_fields
  on public.purchase_receipt_items;
create trigger purchase_receipt_items_set_audit_fields
  before insert or update on public.purchase_receipt_items
  for each row execute function public.set_audit_fields();

create or replace function private.next_purchase_receipt_document_no(
  p_business_id uuid,
  p_branch_id uuid,
  p_receipt_date date
)
returns table (document_no text, document_prefix text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_period text;
  v_next_value bigint;
begin
  select upper(btrim(coalesce(branch.purchase_receipt_prefix, branch.code)))
    into v_prefix
  from public.branches branch
  where branch.id = p_branch_id
    and branch.business_id = p_business_id
    and branch.is_active
    and not branch.is_deleted;

  if v_prefix is null or v_prefix !~ '^[A-Z0-9]{1,12}$' then
    raise exception using
      errcode = 'P0001',
      message = 'รหัสนำหน้าเอกสารของสาขาไม่ถูกต้อง';
  end if;

  v_period := to_char(p_receipt_date, 'YYYYMM');

  insert into private.purchase_receipt_number_counters (
    business_id,
    branch_id,
    document_prefix,
    period_key,
    last_value,
    updated_at
  )
  values (
    p_business_id,
    p_branch_id,
    v_prefix,
    v_period,
    1,
    now()
  )
  on conflict (business_id, branch_id, document_prefix, period_key)
  do update
    set last_value = private.purchase_receipt_number_counters.last_value + 1,
        updated_at = now()
  returning last_value into v_next_value;

  return query
    select
      format('PR-%s-%s-%s', v_prefix, v_period, lpad(v_next_value::text, 6, '0')),
      v_prefix;
end;
$$;

create or replace function private.save_purchase_receipt(
  p_business_id uuid,
  p_branch_id uuid,
  p_supplier_id uuid,
  p_receipt_date date,
  p_exchange_rate numeric,
  p_invoice_number text,
  p_reference text,
  p_notes text,
  p_items jsonb,
  p_receipt_id uuid default null,
  p_expected_updated_at timestamptz default null
)
returns table (
  purchase_receipt_id uuid,
  document_no text,
  status public.purchase_receipt_status,
  subtotal_amount numeric(14,2),
  discount_amount numeric(14,2),
  total_amount numeric(14,2),
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_receipt_id uuid;
  v_document_no text;
  v_document_prefix text;
  v_currency_code text;
  v_existing_branch_id uuid;
  v_existing_status public.purchase_receipt_status;
  v_existing_updated_at timestamptz;
  v_exchange_rate numeric(18,6);
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
begin
  if v_user_id is null or not public.can_manage_business(p_business_id) then
    raise exception using errcode = 'P0001', message = 'ไม่มีสิทธิ์จัดการเอกสารรับสินค้า';
  end if;

  if p_receipt_date is null then
    raise exception using errcode = 'P0001', message = 'กรุณาระบุวันที่รับสินค้า';
  end if;

  if not exists (
    select 1 from public.branches branch
    where branch.id = p_branch_id
      and branch.business_id = p_business_id
      and branch.is_active
      and not branch.is_deleted
  ) or not public.has_branch_access(p_branch_id) then
    raise exception using errcode = 'P0001', message = 'ไม่มีสิทธิ์ใช้งานสาขานี้';
  end if;

  select upper(btrim(business.currency_code::text))
    into v_currency_code
  from public.businesses business
  where business.id = p_business_id
    and business.is_active
    and not business.is_deleted;

  if v_currency_code is null or v_currency_code !~ '^[A-Z]{3}$' then
    raise exception using errcode = 'P0001', message = 'สกุลเงินของธุรกิจไม่ถูกต้อง';
  end if;

  v_exchange_rate := coalesce(p_exchange_rate, 1);
  if v_exchange_rate <= 0 or v_exchange_rate = 'NaN'::numeric then
    raise exception using errcode = 'P0001', message = 'อัตราแลกเปลี่ยนไม่ถูกต้อง';
  end if;

  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers supplier
    where supplier.id = p_supplier_id
      and supplier.business_id = p_business_id
      and supplier.is_active
      and not supplier.is_deleted
  ) then
    raise exception using errcode = 'P0001', message = 'ไม่พบผู้จำหน่าย';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'รายการสินค้าไม่ถูกต้อง';
  end if;

  if jsonb_array_length(v_items) > 500 then
    raise exception using errcode = 'P0001', message = 'รายการสินค้าเกินจำนวนที่รองรับ';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) element
    where not (element ? 'product_id')
      or not (element ? 'quantity')
      or not (element ? 'unit_cost')
  ) then
    raise exception using errcode = 'P0001', message = 'ข้อมูลรายการสินค้าไม่ครบถ้วน';
  end if;

  if exists (
    select 1
    from (
      select (element->>'product_id')::uuid as product_id, count(*)
      from jsonb_array_elements(v_items) element
      group by (element->>'product_id')::uuid
      having count(*) > 1
    ) duplicate
  ) then
    raise exception using errcode = 'P0001', message = 'สินค้าในเอกสารต้องไม่ซ้ำกัน';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) element
    cross join lateral (
      select
        (element->>'quantity')::numeric as quantity,
        (element->>'unit_cost')::numeric as unit_cost,
        coalesce((element->>'line_discount')::numeric, 0) as line_discount
    ) item
    where item.quantity = 'NaN'::numeric
      or item.unit_cost = 'NaN'::numeric
      or item.line_discount = 'NaN'::numeric
      or round(item.quantity, 3) <= 0
      or round(item.unit_cost, 2) < 0
      or round(item.line_discount, 2) < 0
      or round(item.line_discount, 2) > round(round(item.quantity, 3) * round(item.unit_cost, 2), 2)
  ) then
    raise exception using errcode = 'P0001', message = 'จำนวน ราคา หรือส่วนลดไม่ถูกต้อง';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) element
    left join public.products product
      on product.id = (element->>'product_id')::uuid
      and product.business_id = p_business_id
      and product.is_active
      and product.track_stock
      and not product.is_deleted
    where product.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'พบสินค้าที่ไม่พร้อมรับเข้าสต๊อก';
  end if;

  if p_receipt_id is null then
    select generated.document_no, generated.document_prefix
      into v_document_no, v_document_prefix
    from private.next_purchase_receipt_document_no(
      p_business_id,
      p_branch_id,
      p_receipt_date
    ) generated;

    insert into public.purchase_receipts (
      business_id, branch_id, supplier_id, document_prefix, document_no,
      receipt_date, currency_code, exchange_rate, invoice_number, reference,
      notes, created_by, updated_by
    ) values (
      p_business_id, p_branch_id, p_supplier_id, v_document_prefix, v_document_no,
      p_receipt_date, v_currency_code, v_exchange_rate,
      nullif(btrim(p_invoice_number), ''), nullif(btrim(p_reference), ''),
      nullif(btrim(p_notes), ''), v_user_id, v_user_id
    )
    returning id into v_receipt_id;
  else
    select receipt.branch_id, receipt.status, receipt.updated_at
      into v_existing_branch_id, v_existing_status, v_existing_updated_at
    from public.purchase_receipts receipt
    where receipt.id = p_receipt_id
      and receipt.business_id = p_business_id
      and not receipt.is_deleted
    for update;

    if v_existing_status is null then
      raise exception using errcode = 'P0001', message = 'ไม่พบเอกสารรับสินค้า';
    end if;

    if not public.has_branch_access(v_existing_branch_id) then
      raise exception using errcode = 'P0001', message = 'ไม่มีสิทธิ์ใช้งานสาขานี้';
    end if;

    if v_existing_status <> 'draft'::public.purchase_receipt_status then
      raise exception using errcode = 'P0001', message = 'แก้ไขได้เฉพาะเอกสารฉบับร่าง';
    end if;

    if p_expected_updated_at is not null
      and v_existing_updated_at is distinct from p_expected_updated_at
    then
      raise exception using errcode = 'P0001', message = 'เอกสารถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดข้อมูลใหม่';
    end if;

    v_receipt_id := p_receipt_id;

    update public.purchase_receipt_items
    set is_deleted = true,
        updated_by = v_user_id
    where purchase_receipt_id = v_receipt_id
      and not is_deleted;

    update public.purchase_receipts
    set branch_id = p_branch_id,
        supplier_id = p_supplier_id,
        receipt_date = p_receipt_date,
        currency_code = v_currency_code,
        exchange_rate = v_exchange_rate,
        invoice_number = nullif(btrim(p_invoice_number), ''),
        reference = nullif(btrim(p_reference), ''),
        notes = nullif(btrim(p_notes), ''),
        updated_by = v_user_id
    where id = v_receipt_id;
  end if;

  insert into public.purchase_receipt_items (
    purchase_receipt_id, business_id, branch_id, line_no,
    product_id, unit_id, product_name_snapshot, sku_snapshot,
    unit_name_snapshot, unit_abbreviation_snapshot,
    quantity, unit_cost, line_discount, created_by, updated_by
  )
  select
    v_receipt_id,
    p_business_id,
    p_branch_id,
    element.ordinality::integer,
    product.id,
    product.unit_id,
    btrim(product.name),
    nullif(btrim(product.sku), ''),
    unit.name,
    unit.abbreviation,
    round((element.value->>'quantity')::numeric, 3),
    round((element.value->>'unit_cost')::numeric, 2),
    round(coalesce((element.value->>'line_discount')::numeric, 0), 2),
    v_user_id,
    v_user_id
  from jsonb_array_elements(v_items) with ordinality element(value, ordinality)
  join public.products product
    on product.id = (element.value->>'product_id')::uuid
    and product.business_id = p_business_id
    and product.is_active
    and product.track_stock
    and not product.is_deleted
  left join public.units unit
    on unit.id = product.unit_id
    and unit.business_id = p_business_id;

  update public.purchase_receipts receipt
  set subtotal_amount = totals.subtotal_amount,
      discount_amount = totals.discount_amount,
      total_amount = totals.total_amount,
      updated_by = v_user_id
  from (
    select
      coalesce(sum(item.gross_amount), 0)::numeric(14,2) as subtotal_amount,
      coalesce(sum(item.line_discount), 0)::numeric(14,2) as discount_amount,
      coalesce(sum(item.net_amount), 0)::numeric(14,2) as total_amount
    from public.purchase_receipt_items item
    where item.purchase_receipt_id = v_receipt_id
      and not item.is_deleted
  ) totals
  where receipt.id = v_receipt_id;

  return query
    select receipt.id, receipt.document_no, receipt.status,
           receipt.subtotal_amount, receipt.discount_amount,
           receipt.total_amount, receipt.updated_at
    from public.purchase_receipts receipt
    where receipt.id = v_receipt_id;
end;
$$;

create or replace function private.receive_purchase_receipt(
  p_business_id uuid,
  p_receipt_id uuid,
  p_expected_updated_at timestamptz default null
)
returns table (
  purchase_receipt_id uuid,
  document_no text,
  status public.purchase_receipt_status,
  movement_count integer,
  received_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_supplier_id uuid;
  v_document_no text;
  v_status public.purchase_receipt_status;
  v_updated_at timestamptz;
  v_supplier_name text;
  v_supplier_tax_id text;
  v_occurred_at timestamptz := now();
  v_balance_id uuid;
  v_quantity_before numeric(14,3);
  v_quantity_after numeric(14,3);
  v_movement_count integer := 0;
  item record;
begin
  if v_user_id is null or not public.can_manage_business(p_business_id) then
    raise exception using errcode = 'P0001', message = 'ไม่มีสิทธิ์รับสินค้า';
  end if;

  select receipt.branch_id, receipt.supplier_id, receipt.document_no,
         receipt.status, receipt.updated_at
    into v_branch_id, v_supplier_id, v_document_no, v_status, v_updated_at
  from public.purchase_receipts receipt
  where receipt.id = p_receipt_id
    and receipt.business_id = p_business_id
    and not receipt.is_deleted
  for update;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'ไม่พบเอกสารรับสินค้า';
  end if;

  if not public.has_branch_access(v_branch_id) then
    raise exception using errcode = 'P0001', message = 'ไม่มีสิทธิ์ใช้งานสาขานี้';
  end if;

  if v_status <> 'draft'::public.purchase_receipt_status then
    raise exception using errcode = 'P0001', message = 'เอกสารนี้ถูกรับสินค้าหรือยกเลิกแล้ว';
  end if;

  if p_expected_updated_at is not null and v_updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'เอกสารถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดข้อมูลใหม่';
  end if;

  -- supplier_id remains nullable in draft. Required validation occurs here only.
  if v_supplier_id is null then
    raise exception using errcode = 'P0001', message = 'กรุณาเลือกผู้จำหน่ายก่อนรับสินค้า';
  end if;

  select btrim(supplier.name), nullif(btrim(supplier.tax_id), '')
    into v_supplier_name, v_supplier_tax_id
  from public.suppliers supplier
  where supplier.id = v_supplier_id
    and supplier.business_id = p_business_id
    and supplier.is_active
    and not supplier.is_deleted;

  if v_supplier_name is null then
    raise exception using errcode = 'P0001', message = 'ไม่พบผู้จำหน่าย';
  end if;

  if not exists (
    select 1 from public.purchase_receipt_items purchase_item
    where purchase_item.purchase_receipt_id = p_receipt_id
      and not purchase_item.is_deleted
  ) then
    raise exception using errcode = 'P0001', message = 'กรุณาเพิ่มสินค้าอย่างน้อยหนึ่งรายการ';
  end if;

  if exists (
    select 1
    from public.purchase_receipt_items purchase_item
    left join public.products product
      on product.id = purchase_item.product_id
      and product.business_id = p_business_id
      and product.is_active
      and product.track_stock
      and not product.is_deleted
    where purchase_item.purchase_receipt_id = p_receipt_id
      and not purchase_item.is_deleted
      and product.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'พบสินค้าที่ไม่พร้อมรับเข้าสต๊อก';
  end if;

  update public.purchase_receipt_items purchase_item
  set unit_id = product.unit_id,
      product_name_snapshot = btrim(product.name),
      sku_snapshot = nullif(btrim(product.sku), ''),
      unit_name_snapshot = unit.name,
      unit_abbreviation_snapshot = unit.abbreviation,
      updated_by = v_user_id
  from public.products product
  left join public.units unit
    on unit.id = product.unit_id
    and unit.business_id = p_business_id
  where purchase_item.purchase_receipt_id = p_receipt_id
    and not purchase_item.is_deleted
    and product.id = purchase_item.product_id
    and product.business_id = p_business_id;

  insert into public.inventory_balances (
    business_id, branch_id, product_id, quantity, reserved_quantity,
    average_cost, created_by, updated_by
  )
  select p_business_id, v_branch_id, purchase_item.product_id,
         0, 0, 0, v_user_id, v_user_id
  from public.purchase_receipt_items purchase_item
  where purchase_item.purchase_receipt_id = p_receipt_id
    and not purchase_item.is_deleted
  order by purchase_item.product_id
  on conflict (business_id, branch_id, product_id)
    where not is_deleted
    do nothing;

  perform balance.id
  from public.inventory_balances balance
  where balance.business_id = p_business_id
    and balance.branch_id = v_branch_id
    and balance.product_id in (
      select purchase_item.product_id
      from public.purchase_receipt_items purchase_item
      where purchase_item.purchase_receipt_id = p_receipt_id
        and not purchase_item.is_deleted
    )
    and not balance.is_deleted
  order by balance.product_id
  for update;

  for item in
    select purchase_item.*
    from public.purchase_receipt_items purchase_item
    where purchase_item.purchase_receipt_id = p_receipt_id
      and not purchase_item.is_deleted
    order by purchase_item.product_id
  loop
    select balance.id, balance.quantity
      into v_balance_id, v_quantity_before
    from public.inventory_balances balance
    where balance.business_id = p_business_id
      and balance.branch_id = v_branch_id
      and balance.product_id = item.product_id
      and not balance.is_deleted;

    if v_balance_id is null then
      raise exception using errcode = 'P0001', message = 'ไม่สามารถสร้างยอดสต๊อกได้';
    end if;

    v_quantity_after := v_quantity_before + item.quantity;

    update public.inventory_balances
    set quantity = v_quantity_after,
        last_movement_at = v_occurred_at,
        updated_by = v_user_id
    where id = v_balance_id;

    insert into public.inventory_movements (
      business_id, branch_id, product_id, movement_type,
      quantity_change, quantity_before, quantity_after,
      unit_cost, total_cost, reference_type, reference_id,
      reason, notes, occurred_at, created_by
    ) values (
      p_business_id, v_branch_id, item.product_id,
      'purchase'::public.inventory_movement_type,
      item.quantity, v_quantity_before, v_quantity_after,
      round(item.net_amount / item.quantity, 2), item.net_amount,
      'purchase_receipt_item', item.id,
      format('รับสินค้าเข้า %s', v_document_no), null,
      v_occurred_at, v_user_id
    );

    v_movement_count := v_movement_count + 1;
  end loop;

  update public.purchase_receipts
  set status = 'received'::public.purchase_receipt_status,
      supplier_name_snapshot = v_supplier_name,
      supplier_tax_id_snapshot = v_supplier_tax_id,
      received_at = v_occurred_at,
      received_by = v_user_id,
      updated_by = v_user_id
  where id = p_receipt_id;

  return query
    select receipt.id, receipt.document_no, receipt.status,
           v_movement_count, receipt.received_at
    from public.purchase_receipts receipt
    where receipt.id = p_receipt_id;
end;
$$;

create or replace function private.cancel_purchase_receipt(
  p_business_id uuid,
  p_receipt_id uuid,
  p_cancellation_reason text,
  p_expected_updated_at timestamptz default null
)
returns table (
  purchase_receipt_id uuid,
  document_no text,
  status public.purchase_receipt_status,
  movement_count integer,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_document_no text;
  v_status public.purchase_receipt_status;
  v_updated_at timestamptz;
  v_occurred_at timestamptz := now();
  v_balance_id uuid;
  v_quantity_before numeric(14,3);
  v_quantity_after numeric(14,3);
  v_reserved_quantity numeric(14,3);
  v_movement_count integer := 0;
  item record;
begin
  if v_user_id is null or not public.can_manage_business(p_business_id) then
    raise exception using errcode = 'P0001', message = 'ไม่มีสิทธิ์ยกเลิกเอกสารรับสินค้า';
  end if;

  if coalesce(btrim(p_cancellation_reason), '') = '' then
    raise exception using errcode = 'P0001', message = 'กรุณาระบุเหตุผลที่ยกเลิก';
  end if;

  select receipt.branch_id, receipt.document_no, receipt.status, receipt.updated_at
    into v_branch_id, v_document_no, v_status, v_updated_at
  from public.purchase_receipts receipt
  where receipt.id = p_receipt_id
    and receipt.business_id = p_business_id
    and not receipt.is_deleted
  for update;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'ไม่พบเอกสารรับสินค้า';
  end if;

  if not public.has_branch_access(v_branch_id) then
    raise exception using errcode = 'P0001', message = 'ไม่มีสิทธิ์ใช้งานสาขานี้';
  end if;

  if v_status <> 'received'::public.purchase_receipt_status then
    raise exception using errcode = 'P0001', message = 'ยกเลิกได้เฉพาะเอกสารที่รับสินค้าแล้ว';
  end if;

  if p_expected_updated_at is not null and v_updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'เอกสารถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดข้อมูลใหม่';
  end if;

  perform balance.id
  from public.inventory_balances balance
  where balance.business_id = p_business_id
    and balance.branch_id = v_branch_id
    and balance.product_id in (
      select purchase_item.product_id
      from public.purchase_receipt_items purchase_item
      where purchase_item.purchase_receipt_id = p_receipt_id
        and not purchase_item.is_deleted
    )
    and not balance.is_deleted
  order by balance.product_id
  for update;

  for item in
    select purchase_item.*
    from public.purchase_receipt_items purchase_item
    where purchase_item.purchase_receipt_id = p_receipt_id
      and not purchase_item.is_deleted
    order by purchase_item.product_id
  loop
    select balance.id, balance.quantity, balance.reserved_quantity
      into v_balance_id, v_quantity_before, v_reserved_quantity
    from public.inventory_balances balance
    where balance.business_id = p_business_id
      and balance.branch_id = v_branch_id
      and balance.product_id = item.product_id
      and not balance.is_deleted;

    if v_balance_id is null then
      raise exception using errcode = 'P0001', message = 'ไม่พบยอดสต๊อกสำหรับย้อนรายการ';
    end if;

    v_quantity_after := v_quantity_before - item.quantity;

    if v_quantity_after < 0 then
      raise exception using
        errcode = 'P0001',
        message = 'สต๊อกคงเหลือไม่เพียงพอ ไม่สามารถปรับยอดให้ติดลบได้';
    end if;

    if v_reserved_quantity > v_quantity_after then
      raise exception using
        errcode = 'P0001',
        message = 'สต๊อกคงเหลือหลังยกเลิกต้องไม่น้อยกว่ายอดจอง';
    end if;

    update public.inventory_balances
    set quantity = v_quantity_after,
        last_movement_at = v_occurred_at,
        updated_by = v_user_id
    where id = v_balance_id;

    insert into public.inventory_movements (
      business_id, branch_id, product_id, movement_type,
      quantity_change, quantity_before, quantity_after,
      unit_cost, total_cost, reference_type, reference_id,
      reason, notes, occurred_at, created_by
    ) values (
      p_business_id, v_branch_id, item.product_id,
      'purchase_return'::public.inventory_movement_type,
      -item.quantity, v_quantity_before, v_quantity_after,
      round(item.net_amount / item.quantity, 2), item.net_amount,
      'purchase_receipt_item', item.id,
      format('ยกเลิกการรับสินค้า %s', v_document_no), btrim(p_cancellation_reason),
      v_occurred_at, v_user_id
    );

    v_movement_count := v_movement_count + 1;
  end loop;

  update public.purchase_receipts
  set status = 'cancelled'::public.purchase_receipt_status,
      cancelled_at = v_occurred_at,
      cancelled_by = v_user_id,
      cancellation_reason = btrim(p_cancellation_reason),
      updated_by = v_user_id
  where id = p_receipt_id;

  return query
    select receipt.id, receipt.document_no, receipt.status,
           v_movement_count, receipt.cancelled_at
    from public.purchase_receipts receipt
    where receipt.id = p_receipt_id;
end;
$$;

create or replace function private.discard_purchase_receipt(
  p_business_id uuid,
  p_receipt_id uuid,
  p_expected_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_status public.purchase_receipt_status;
  v_updated_at timestamptz;
begin
  if v_user_id is null or not public.can_manage_business(p_business_id) then
    raise exception using errcode = 'P0001', message = 'ไม่มีสิทธิ์ลบเอกสารรับสินค้า';
  end if;

  select receipt.branch_id, receipt.status, receipt.updated_at
    into v_branch_id, v_status, v_updated_at
  from public.purchase_receipts receipt
  where receipt.id = p_receipt_id
    and receipt.business_id = p_business_id
    and not receipt.is_deleted
  for update;

  if v_status is null then
    raise exception using errcode = 'P0001', message = 'ไม่พบเอกสารรับสินค้า';
  end if;

  if not public.has_branch_access(v_branch_id) then
    raise exception using errcode = 'P0001', message = 'ไม่มีสิทธิ์ใช้งานสาขานี้';
  end if;

  if v_status <> 'draft'::public.purchase_receipt_status then
    raise exception using errcode = 'P0001', message = 'ลบได้เฉพาะเอกสารฉบับร่าง';
  end if;

  if p_expected_updated_at is not null and v_updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'เอกสารถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดข้อมูลใหม่';
  end if;

  update public.purchase_receipt_items
  set is_deleted = true,
      updated_by = v_user_id
  where purchase_receipt_id = p_receipt_id
    and not is_deleted;

  update public.purchase_receipts
  set is_deleted = true,
      updated_by = v_user_id
  where id = p_receipt_id;

  return p_receipt_id;
end;
$$;

create or replace function public.save_purchase_receipt(
  p_business_id uuid,
  p_branch_id uuid,
  p_supplier_id uuid,
  p_receipt_date date,
  p_exchange_rate numeric,
  p_invoice_number text,
  p_reference text,
  p_notes text,
  p_items jsonb,
  p_receipt_id uuid default null,
  p_expected_updated_at timestamptz default null
)
returns table (
  purchase_receipt_id uuid,
  document_no text,
  status public.purchase_receipt_status,
  subtotal_amount numeric(14,2),
  discount_amount numeric(14,2),
  total_amount numeric(14,2),
  updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.save_purchase_receipt(
    p_business_id, p_branch_id, p_supplier_id, p_receipt_date,
    p_exchange_rate, p_invoice_number, p_reference, p_notes, p_items,
    p_receipt_id, p_expected_updated_at
  );
$$;

create or replace function public.receive_purchase_receipt(
  p_business_id uuid,
  p_receipt_id uuid,
  p_expected_updated_at timestamptz default null
)
returns table (
  purchase_receipt_id uuid,
  document_no text,
  status public.purchase_receipt_status,
  movement_count integer,
  received_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.receive_purchase_receipt(
    p_business_id, p_receipt_id, p_expected_updated_at
  );
$$;

create or replace function public.cancel_purchase_receipt(
  p_business_id uuid,
  p_receipt_id uuid,
  p_cancellation_reason text,
  p_expected_updated_at timestamptz default null
)
returns table (
  purchase_receipt_id uuid,
  document_no text,
  status public.purchase_receipt_status,
  movement_count integer,
  cancelled_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.cancel_purchase_receipt(
    p_business_id, p_receipt_id, p_cancellation_reason, p_expected_updated_at
  );
$$;

create or replace function public.discard_purchase_receipt(
  p_business_id uuid,
  p_receipt_id uuid,
  p_expected_updated_at timestamptz default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.discard_purchase_receipt(
    p_business_id, p_receipt_id, p_expected_updated_at
  );
$$;

alter table public.suppliers enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;

drop policy if exists "Active members can view suppliers" on public.suppliers;
create policy "Active members can view suppliers"
  on public.suppliers for select to authenticated
  using (
    (not is_deleted and public.is_business_member(business_id))
    or public.can_manage_business(business_id)
  );

drop policy if exists "Owners and managers can add suppliers" on public.suppliers;
create policy "Owners and managers can add suppliers"
  on public.suppliers for insert to authenticated
  with check (not is_deleted and public.can_manage_business(business_id));

drop policy if exists "Owners and managers can update suppliers" on public.suppliers;
create policy "Owners and managers can update suppliers"
  on public.suppliers for update to authenticated
  using (public.can_manage_business(business_id))
  with check (public.can_manage_business(business_id));

drop policy if exists "Authorized members can view purchase receipts"
  on public.purchase_receipts;
create policy "Authorized members can view purchase receipts"
  on public.purchase_receipts for select to authenticated
  using (
    not is_deleted
    and public.is_business_member(business_id)
    and public.has_branch_access(branch_id)
  );

drop policy if exists "Authorized members can view purchase receipt items"
  on public.purchase_receipt_items;
create policy "Authorized members can view purchase receipt items"
  on public.purchase_receipt_items for select to authenticated
  using (
    not is_deleted
    and public.is_business_member(business_id)
    and public.has_branch_access(branch_id)
  );

-- Suppliers use normal RLS writes. Receipts and items are RPC-only writes.
-- No purchase table receives DELETE privileges or a DELETE policy.
revoke all on table public.suppliers, public.purchase_receipts,
  public.purchase_receipt_items from public, anon, authenticated;
grant select, insert, update on table public.suppliers to authenticated;
grant select on table public.purchase_receipts,
  public.purchase_receipt_items to authenticated;

revoke all on table private.purchase_receipt_number_counters
  from public, anon, authenticated;

revoke all on type public.purchase_receipt_status from public, anon, authenticated;
grant usage on type public.purchase_receipt_status to authenticated;

revoke all on function private.normalize_purchase_receipt_prefix()
  from public, anon, authenticated;
revoke all on function private.prevent_supplier_business_change()
  from public, anon, authenticated;
revoke all on function private.guard_purchase_receipt_mutation()
  from public, anon, authenticated;
revoke all on function private.guard_purchase_receipt_item_mutation()
  from public, anon, authenticated;
revoke all on function private.next_purchase_receipt_document_no(uuid, uuid, date)
  from public, anon, authenticated;

grant usage on schema private to authenticated;

revoke all on function private.save_purchase_receipt(
  uuid, uuid, uuid, date, numeric, text, text, text, jsonb, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function private.save_purchase_receipt(
  uuid, uuid, uuid, date, numeric, text, text, text, jsonb, uuid, timestamptz
) to authenticated;

revoke all on function private.receive_purchase_receipt(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function private.receive_purchase_receipt(uuid, uuid, timestamptz)
  to authenticated;

revoke all on function private.cancel_purchase_receipt(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function private.cancel_purchase_receipt(uuid, uuid, text, timestamptz)
  to authenticated;

revoke all on function private.discard_purchase_receipt(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function private.discard_purchase_receipt(uuid, uuid, timestamptz)
  to authenticated;

revoke all on function public.save_purchase_receipt(
  uuid, uuid, uuid, date, numeric, text, text, text, jsonb, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.save_purchase_receipt(
  uuid, uuid, uuid, date, numeric, text, text, text, jsonb, uuid, timestamptz
) to authenticated;

revoke all on function public.receive_purchase_receipt(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.receive_purchase_receipt(uuid, uuid, timestamptz)
  to authenticated;

revoke all on function public.cancel_purchase_receipt(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cancel_purchase_receipt(uuid, uuid, text, timestamptz)
  to authenticated;

revoke all on function public.discard_purchase_receipt(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.discard_purchase_receipt(uuid, uuid, timestamptz)
  to authenticated;

commit;
