import { supabase } from './supabase'

export type InventoryMovementType =
  | 'opening_balance'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'stock_count'

export type InventoryBranch = {
  code: string
  id: string
  is_headquarters: boolean
  name: string
}

export type InventoryCategory = {
  id: string
  name: string
}

export type InventoryItem = {
  available_quantity: number
  branch_code: string
  branch_id: string
  branch_name: string
  category_id: string | null
  category_name: string | null
  is_product_active: boolean
  last_movement_at: string | null
  low_stock_threshold: number
  product_id: string
  product_name: string
  quantity: number
  reserved_quantity: number
  sku: string | null
  unit_abbreviation: string | null
  unit_name: string | null
}

export type InventoryMovement = {
  branch_id: string
  branch_name: string
  id: string
  movement_type: InventoryMovementType
  occurred_at: string
  product_id: string
  product_name: string
  quantity_after: number
  quantity_before: number
  quantity_change: number
  reason: string
}

export type InventoryData = {
  branches: InventoryBranch[]
  categories: InventoryCategory[]
  items: InventoryItem[]
  movements: InventoryMovement[]
}

export type InventoryAdjustmentInput = {
  branchId: string
  businessId: string
  movementType: InventoryMovementType
  notes: string
  productId: string
  quantity: number
  reason: string
}

type ErrorLike = {
  code?: string
  details?: string
  hint?: string
  message?: string
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase')
  }

  return supabase
}

function toNumber(value: number | string | null | undefined) {
  const converted = Number(value ?? 0)
  return Number.isFinite(converted) ? converted : 0
}

export function translateInventoryError(error: unknown) {
  const candidate = error as ErrorLike
  const combined = `${candidate.message ?? ''} ${candidate.details ?? ''} ${candidate.hint ?? ''}`.toLowerCase()

  if (candidate.code === 'PGRST202' || candidate.code === '42883') {
    return 'ไม่พบระบบปรับสต๊อก กรุณาตรวจสอบว่า Migration 004 ถูกติดตั้งแล้ว'
  }

  if (candidate.code === '42501' || combined.includes('row-level security')) {
    return 'ไม่มีสิทธิ์เข้าถึงข้อมูลสต๊อกของสาขานี้'
  }

  if (candidate.message && /[ก-๙]/u.test(candidate.message)) {
    return candidate.message
  }

  if (candidate.code === '23514') {
    return 'จำนวนสต๊อกไม่ถูกต้อง กรุณาตรวจสอบยอดคงเหลือและยอดจอง'
  }

  return 'ไม่สามารถดำเนินการกับข้อมูลสต๊อกได้ กรุณาลองใหม่อีกครั้ง'
}

export async function loadInventoryData(businessId: string): Promise<InventoryData> {
  const client = requireSupabase()
  const [branchResult, categoryResult, unitResult, productResult, balanceResult, movementResult] = await Promise.all([
    client
      .from('branches')
      .select('id, name, code, is_headquarters')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('is_headquarters', { ascending: false })
      .order('name', { ascending: true }),
    client
      .from('product_categories')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
    client
      .from('units')
      .select('id, name, abbreviation')
      .eq('business_id', businessId)
      .eq('is_deleted', false),
    client
      .from('products')
      .select('id, category_id, unit_id, name, sku, low_stock_threshold, is_active')
      .eq('business_id', businessId)
      .eq('track_stock', true)
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
    client
      .from('inventory_balances')
      .select('branch_id, product_id, quantity, reserved_quantity, last_movement_at')
      .eq('business_id', businessId)
      .eq('is_deleted', false),
    client
      .from('inventory_movements')
      .select('id, branch_id, product_id, movement_type, quantity_change, quantity_before, quantity_after, reason, occurred_at')
      .eq('business_id', businessId)
      .eq('is_deleted', false)
      .order('occurred_at', { ascending: false })
      .limit(20),
  ])

  const firstError = branchResult.error
    ?? categoryResult.error
    ?? unitResult.error
    ?? productResult.error
    ?? balanceResult.error
    ?? movementResult.error

  if (firstError) {
    throw new Error(translateInventoryError(firstError))
  }

  const branches = (branchResult.data ?? []) as InventoryBranch[]
  const categories = (categoryResult.data ?? []) as InventoryCategory[]
  const units = unitResult.data ?? []
  const products = productResult.data ?? []
  const balances = balanceResult.data ?? []
  const unitMap = new Map(units.map((unit) => [unit.id, unit]))
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  const productMap = new Map(products.map((product) => [product.id, product.name]))
  const branchMap = new Map(branches.map((branch) => [branch.id, branch.name]))
  const balanceMap = new Map(balances.map((balance) => [
    `${balance.branch_id}:${balance.product_id}`,
    balance,
  ]))

  const items = branches.flatMap((branch) => products.map((product) => {
    const balance = balanceMap.get(`${branch.id}:${product.id}`)
    const unit = product.unit_id ? unitMap.get(product.unit_id) : undefined
    const quantity = toNumber(balance?.quantity)
    const reservedQuantity = toNumber(balance?.reserved_quantity)

    return {
      available_quantity: quantity - reservedQuantity,
      branch_code: branch.code,
      branch_id: branch.id,
      branch_name: branch.name,
      category_id: product.category_id,
      category_name: product.category_id ? categoryMap.get(product.category_id) ?? null : null,
      is_product_active: product.is_active,
      last_movement_at: balance?.last_movement_at ?? null,
      low_stock_threshold: toNumber(product.low_stock_threshold),
      product_id: product.id,
      product_name: product.name,
      quantity,
      reserved_quantity: reservedQuantity,
      sku: product.sku,
      unit_abbreviation: unit?.abbreviation ?? null,
      unit_name: unit?.name ?? null,
    } satisfies InventoryItem
  }))

  const movements = (movementResult.data ?? []).map((movement) => ({
    branch_id: movement.branch_id,
    branch_name: branchMap.get(movement.branch_id) ?? 'สาขาที่ไม่พบข้อมูล',
    id: movement.id,
    movement_type: movement.movement_type as InventoryMovementType,
    occurred_at: movement.occurred_at,
    product_id: movement.product_id,
    product_name: productMap.get(movement.product_id) ?? 'สินค้าที่ไม่พบข้อมูล',
    quantity_after: toNumber(movement.quantity_after),
    quantity_before: toNumber(movement.quantity_before),
    quantity_change: toNumber(movement.quantity_change),
    reason: movement.reason,
  }))

  return { branches, categories, items, movements }
}

export async function adjustInventory(input: InventoryAdjustmentInput) {
  const client = requireSupabase()
  const { error } = await client.rpc('adjust_inventory', {
    p_branch_id: input.branchId,
    p_business_id: input.businessId,
    p_movement_type: input.movementType,
    p_notes: input.notes.trim() || null,
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_reason: input.reason.trim(),
  })

  if (error) {
    throw new Error(translateInventoryError(error))
  }
}
