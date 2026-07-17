import { supabase } from './supabase'

export type ProductCategory = {
  description: string | null
  id: string
  is_active: boolean
  name: string
  sort_order: number
}

export type ProductUnit = {
  abbreviation: string | null
  id: string
  is_active: boolean
  name: string
}

export type ProductRecord = {
  barcode: string | null
  category_id: string | null
  category_name: string | null
  cost_price: number
  description: string | null
  id: string
  is_active: boolean
  low_stock_threshold: number
  name: string
  selling_price: number
  sku: string | null
  track_stock: boolean
  unit_abbreviation: string | null
  unit_id: string | null
  unit_name: string | null
}

export type ProductInput = {
  barcode: string
  categoryId: string
  costPrice: number
  description: string
  isActive: boolean
  lowStockThreshold: number
  name: string
  sellingPrice: number
  sku: string
  trackStock: boolean
  unitId: string
}

export type CategoryInput = {
  description: string
  name: string
  sortOrder: number
}

export type UnitInput = {
  abbreviation: string
  name: string
}

type ProductMasterData = {
  categories: ProductCategory[]
  products: ProductRecord[]
  units: ProductUnit[]
}

type ErrorLike = {
  code?: string
  details?: string
  message?: string
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase')
  }

  return supabase
}

function cleanOptional(value: string) {
  const cleaned = value.trim()
  return cleaned || null
}

export function translateProductMasterError(error: unknown) {
  const candidate = error as ErrorLike
  const combined = `${candidate.message ?? ''} ${candidate.details ?? ''}`.toLowerCase()

  if (candidate.code === 'PGRST205' || candidate.code === '42P01') {
    return 'ยังไม่ได้ติดตั้งฐานข้อมูล Product Master กรุณานำ migration Sprint 5 ไปใช้ก่อน'
  }

  if (candidate.code === '42501' || combined.includes('row-level security')) {
    return 'ไม่พบสิทธิ์จัดการข้อมูล กรุณาตรวจสอบบทบาทของคุณ'
  }

  if (combined.includes('products_unique_active_sku')) {
    return 'SKU นี้ถูกใช้แล้วในธุรกิจนี้'
  }

  if (combined.includes('products_unique_active_barcode')) {
    return 'Barcode นี้ถูกใช้แล้วในธุรกิจนี้'
  }

  if (combined.includes('product_categories_unique_active_name')) {
    return 'ชื่อหมวดหมู่นี้มีอยู่แล้ว'
  }

  if (combined.includes('units_unique_active_name')) {
    return 'ชื่อหน่วยนับนี้มีอยู่แล้ว'
  }

  if (combined.includes('product category must belong')) {
    return 'หมวดหมู่ที่เลือกไม่ได้อยู่ในธุรกิจปัจจุบัน'
  }

  if (combined.includes('product unit must belong')) {
    return 'หน่วยนับที่เลือกไม่ได้อยู่ในธุรกิจปัจจุบัน'
  }

  if (combined.includes('product category is still referenced by active products')) {
    return 'หมวดหมู่นี้ยังมีสินค้าใช้งานอยู่ กรุณาย้ายสินค้าก่อนลบ'
  }

  if (combined.includes('product unit is still referenced by active products')) {
    return 'หน่วยนับนี้ยังมีสินค้าใช้งานอยู่ กรุณาย้ายสินค้าก่อนลบ'
  }

  if (candidate.code === '23514') {
    return 'ราคาและจุดแจ้งเตือนต้องเป็นศูนย์หรือมากกว่า'
  }

  return 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
}

export async function loadProductMasterData(businessId: string): Promise<ProductMasterData> {
  const client = requireSupabase()
  const [categoryResult, unitResult, productResult] = await Promise.all([
    client
      .from('product_categories')
      .select('id, name, description, sort_order, is_active')
      .eq('business_id', businessId)
      .eq('is_deleted', false)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    client
      .from('units')
      .select('id, name, abbreviation, is_active')
      .eq('business_id', businessId)
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
    client
      .from('products')
      .select('id, category_id, unit_id, name, sku, barcode, description, cost_price, selling_price, track_stock, low_stock_threshold, is_active')
      .eq('business_id', businessId)
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
  ])

  const firstError = categoryResult.error ?? unitResult.error ?? productResult.error
  if (firstError) {
    throw new Error(translateProductMasterError(firstError))
  }

  const categories = (categoryResult.data ?? []) as ProductCategory[]
  const units = (unitResult.data ?? []) as ProductUnit[]
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  const unitMap = new Map(units.map((unit) => [unit.id, unit]))
  const products = (productResult.data ?? []).map((product) => {
    const unit = product.unit_id ? unitMap.get(product.unit_id) : undefined
    return {
      ...product,
      category_name: product.category_id ? categoryMap.get(product.category_id) ?? null : null,
      unit_abbreviation: unit?.abbreviation ?? null,
      unit_name: unit?.name ?? null,
    } as ProductRecord
  })

  return { categories, products, units }
}

export async function getProductCount(businessId: string) {
  const client = requireSupabase()
  const { count, error } = await client
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_deleted', false)

  if (error) {
    throw new Error(translateProductMasterError(error))
  }

  return count ?? 0
}

function productPayload(input: ProductInput) {
  return {
    barcode: cleanOptional(input.barcode),
    category_id: cleanOptional(input.categoryId),
    cost_price: input.costPrice,
    description: cleanOptional(input.description),
    is_active: input.isActive,
    low_stock_threshold: input.lowStockThreshold,
    name: input.name.trim(),
    selling_price: input.sellingPrice,
    sku: cleanOptional(input.sku),
    track_stock: input.trackStock,
    unit_id: cleanOptional(input.unitId),
  }
}

export async function createProduct(businessId: string, input: ProductInput) {
  const client = requireSupabase()
  const { error } = await client.from('products').insert({
    business_id: businessId,
    ...productPayload(input),
  })

  if (error) {
    throw new Error(translateProductMasterError(error))
  }
}

export async function updateProduct(businessId: string, productId: string, input: ProductInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('products')
    .update(productPayload(input))
    .eq('id', productId)
    .eq('business_id', businessId)
    .eq('is_deleted', false)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(translateProductMasterError(error))
  }
  if (!data) {
    throw new Error('ไม่พบสินค้าหรือคุณไม่มีสิทธิ์แก้ไข')
  }
}

export async function softDeleteProduct(businessId: string, productId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('products')
    .update({ is_active: false, is_deleted: true })
    .eq('id', productId)
    .eq('business_id', businessId)
    .eq('is_deleted', false)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(translateProductMasterError(error))
  }
  if (!data) {
    throw new Error('ไม่พบสินค้าหรือคุณไม่มีสิทธิ์ลบ')
  }
}

export async function createCategory(businessId: string, input: CategoryInput) {
  const client = requireSupabase()
  const { error } = await client.from('product_categories').insert({
    business_id: businessId,
    description: cleanOptional(input.description),
    name: input.name.trim(),
    sort_order: input.sortOrder,
  })

  if (error) {
    throw new Error(translateProductMasterError(error))
  }
}

export async function updateCategory(businessId: string, categoryId: string, input: CategoryInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('product_categories')
    .update({
      description: cleanOptional(input.description),
      name: input.name.trim(),
      sort_order: input.sortOrder,
    })
    .eq('id', categoryId)
    .eq('business_id', businessId)
    .eq('is_deleted', false)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(translateProductMasterError(error))
  }
  if (!data) {
    throw new Error('ไม่พบหมวดหมู่หรือคุณไม่มีสิทธิ์แก้ไข')
  }
}

export async function softDeleteCategory(businessId: string, categoryId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('product_categories')
    .update({ is_active: false, is_deleted: true })
    .eq('id', categoryId)
    .eq('business_id', businessId)
    .eq('is_deleted', false)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(translateProductMasterError(error))
  }
  if (!data) {
    throw new Error('ไม่พบหมวดหมู่หรือคุณไม่มีสิทธิ์ลบ')
  }
}

export async function createUnit(businessId: string, input: UnitInput) {
  const client = requireSupabase()
  const { error } = await client.from('units').insert({
    abbreviation: cleanOptional(input.abbreviation),
    business_id: businessId,
    name: input.name.trim(),
  })

  if (error) {
    throw new Error(translateProductMasterError(error))
  }
}

export async function updateUnit(businessId: string, unitId: string, input: UnitInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('units')
    .update({ abbreviation: cleanOptional(input.abbreviation), name: input.name.trim() })
    .eq('id', unitId)
    .eq('business_id', businessId)
    .eq('is_deleted', false)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(translateProductMasterError(error))
  }
  if (!data) {
    throw new Error('ไม่พบหน่วยนับหรือคุณไม่มีสิทธิ์แก้ไข')
  }
}

export async function softDeleteUnit(businessId: string, unitId: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('units')
    .update({ is_active: false, is_deleted: true })
    .eq('id', unitId)
    .eq('business_id', businessId)
    .eq('is_deleted', false)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(translateProductMasterError(error))
  }
  if (!data) {
    throw new Error('ไม่พบหน่วยนับหรือคุณไม่มีสิทธิ์ลบ')
  }
}
