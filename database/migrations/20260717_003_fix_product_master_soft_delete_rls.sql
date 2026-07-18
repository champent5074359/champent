-- Let owners and managers see a row after it is soft-deleted so PostgreSQL can
-- complete an UPDATE under RLS. Active staff members still see active rows only.

drop policy if exists "Active members can view product categories"
  on public.product_categories;

create policy "Active members can view product categories"
  on public.product_categories for select
  using (
    (not is_deleted and public.is_business_member(business_id))
    or public.can_manage_business(business_id)
  );

drop policy if exists "Active members can view units"
  on public.units;

create policy "Active members can view units"
  on public.units for select
  using (
    (not is_deleted and public.is_business_member(business_id))
    or public.can_manage_business(business_id)
  );

drop policy if exists "Active members can view products"
  on public.products;

create policy "Active members can view products"
  on public.products for select
  using (
    (not is_deleted and public.is_business_member(business_id))
    or public.can_manage_business(business_id)
  );
