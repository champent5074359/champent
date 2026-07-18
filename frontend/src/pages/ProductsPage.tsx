import { useCallback, useEffect, useMemo, useState } from 'react'
import { CategoryManagerModal } from '../components/CategoryManagerModal'
import { ProductFormModal } from '../components/ProductFormModal'
import { UnitManagerModal } from '../components/UnitManagerModal'
import { useDashboardContext } from '../hooks/useDashboardContext'
import {
  createCategory,
  createBasicUnits,
  createProduct,
  createUnit,
  loadProductMasterData,
  softDeleteCategory,
  softDeleteProduct,
  softDeleteUnit,
  updateCategory,
  updateProduct,
  updateUnit,
} from '../services/productMaster'
import type {
  CategoryInput,
  ProductCategory,
  ProductInput,
  ProductRecord,
  ProductUnit,
  UnitInput,
} from '../services/productMaster'
import { formatCurrency } from '../utils/formatters'

export function ProductsPage() {
  const { data: workspace, error: workspaceError, isLoading: isWorkspaceLoading } = useDashboardContext()
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [units, setUnits] = useState<ProductUnit[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null)
  const [isProductFormOpen, setIsProductFormOpen] = useState(false)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [isUnitManagerOpen, setIsUnitManagerOpen] = useState(false)
  const canManage = workspace?.memberRole === 'owner' || workspace?.memberRole === 'manager'

  const refreshData = useCallback(async () => {
    if (!workspace?.businessId) {
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const data = await loadProductMasterData(workspace.businessId)
      setCategories(data.categories)
      setProducts(data.products)
      setUnits(data.units)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถโหลดข้อมูลสินค้าได้')
    } finally {
      setIsLoading(false)
    }
  }, [workspace?.businessId])

  useEffect(() => {
    if (workspace?.businessId) {
      void refreshData()
    }
  }, [refreshData, workspace?.businessId])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('th')
    return products.filter((product) => {
      const matchesCategory = !categoryFilter || product.category_id === categoryFilter
      const matchesSearch = !normalizedSearch || [product.name, product.sku ?? '', product.barcode ?? '']
        .some((value) => value.toLocaleLowerCase('th').includes(normalizedSearch))
      return matchesCategory && matchesSearch
    })
  }, [categoryFilter, products, search])

  function openCreateProduct() {
    setEditingProduct(null)
    setIsProductFormOpen(true)
    setError('')
    setSuccess('')
  }

  function openEditProduct(product: ProductRecord) {
    setEditingProduct(product)
    setIsProductFormOpen(true)
    setError('')
    setSuccess('')
  }

  async function handleSaveProduct(input: ProductInput) {
    if (!workspace?.businessId) {
      throw new Error('ไม่พบธุรกิจปัจจุบัน')
    }

    setIsSaving(true)
    try {
      if (editingProduct) {
        await updateProduct(workspace.businessId, editingProduct.id, input)
        setSuccess('แก้ไขสินค้าเรียบร้อยแล้ว')
      } else {
        await createProduct(workspace.businessId, input)
        setSuccess('เพิ่มสินค้าเรียบร้อยแล้ว')
      }
      setIsProductFormOpen(false)
      await refreshData()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteProduct(product: ProductRecord) {
    if (!workspace?.businessId || !window.confirm(`ต้องการลบสินค้า “${product.name}” หรือไม่? ข้อมูลจะถูกซ่อนแบบ Soft Delete`)) {
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      await softDeleteProduct(workspace.businessId, product.id)
      setSuccess('ลบสินค้าเรียบร้อยแล้ว')
      await refreshData()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถลบสินค้าได้')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveCategory(input: CategoryInput, categoryId?: string) {
    if (!workspace?.businessId) throw new Error('ไม่พบธุรกิจปัจจุบัน')
    setIsSaving(true)
    try {
      if (categoryId) await updateCategory(workspace.businessId, categoryId, input)
      else await createCategory(workspace.businessId, input)
      await refreshData()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveUnit(input: UnitInput, unitId?: string) {
    if (!workspace?.businessId) throw new Error('ไม่พบธุรกิจปัจจุบัน')
    setIsSaving(true)
    try {
      if (unitId) await updateUnit(workspace.businessId, unitId, input)
      else await createUnit(workspace.businessId, input)
      await refreshData()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteCategory(category: ProductCategory) {
    if (!workspace?.businessId) throw new Error('ไม่พบธุรกิจปัจจุบัน')
    setIsSaving(true)
    try {
      await softDeleteCategory(workspace.businessId, category.id)
      await refreshData()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteUnit(unit: ProductUnit) {
    if (!workspace?.businessId) throw new Error('ไม่พบธุรกิจปัจจุบัน')
    setIsSaving(true)
    try {
      await softDeleteUnit(workspace.businessId, unit.id)
      await refreshData()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddBasicUnits() {
    if (!workspace?.businessId) throw new Error('ไม่พบธุรกิจปัจจุบัน')
    setIsSaving(true)
    try {
      const createdCount = await createBasicUnits(workspace.businessId)
      await refreshData()
      return createdCount
    } finally {
      setIsSaving(false)
    }
  }

  if (isWorkspaceLoading) {
    return <section className="page-state" aria-live="polite">กำลังโหลดพื้นที่ธุรกิจ…</section>
  }

  if (workspaceError || !workspace) {
    return <section className="page-state error-state" role="alert">{workspaceError || 'ไม่พบพื้นที่ธุรกิจ'}</section>
  }

  return (
    <div className="products-page">
      <section className="products-heading">
        <div>
          <p className="eyebrow">Product Master</p>
          <h2>สินค้า</h2>
          <p>จัดการข้อมูลสินค้า หมวดหมู่ และหน่วยนับของ {workspace.businessName}</p>
        </div>
        {canManage && <button className="primary-button" onClick={openCreateProduct} type="button">+ เพิ่มสินค้า</button>}
      </section>

      {!canManage && <p className="permission-notice">บัญชี staff สามารถดูข้อมูลสินค้าได้อย่างเดียว</p>}
      {error && <p className="form-error page-message" role="alert">{error}</p>}
      {success && <p className="form-success page-message" role="status">{success}</p>}

      <section className="product-toolbar" aria-label="ค้นหาและกรองสินค้า">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาจากชื่อ SKU หรือ Barcode" type="search" value={search} />
        </label>
        <label className="filter-field">
          <span>หมวดหมู่</span>
          <select onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
            <option value="">ทั้งหมด</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <div className="master-buttons">
          <button className="secondary-button" onClick={() => setIsCategoryManagerOpen(true)} type="button">จัดการหมวดหมู่</button>
          {canManage && <button className="secondary-button" onClick={() => setIsUnitManagerOpen(true)} type="button">จัดการหน่วยนับ</button>}
        </div>
      </section>

      <section className="product-list-card">
        {isLoading ? (
          <div className="empty-state" aria-live="polite"><strong>กำลังโหลดสินค้า…</strong><span>กรุณารอสักครู่</span></div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <strong>{products.length === 0 ? 'ยังไม่มีสินค้า' : 'ไม่พบสินค้าที่ค้นหา'}</strong>
            <span>{products.length === 0 ? 'เริ่มต้นด้วยการเพิ่มหมวดหมู่ หน่วยนับ และสินค้าแรกของคุณ' : 'ลองเปลี่ยนคำค้นหาหรือตัวกรองหมวดหมู่'}</span>
            {products.length === 0 && canManage && <button className="primary-button" onClick={openCreateProduct} type="button">เพิ่มสินค้าแรก</button>}
          </div>
        ) : (
          <div className="product-table-wrap">
            <table className="product-table">
              <thead><tr><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>SKU</th><th>หน่วย</th><th>ต้นทุน</th><th>ราคาขาย</th><th>สถานะ</th>{canManage && <th>จัดการ</th>}</tr></thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td data-label="ชื่อสินค้า"><strong>{product.name}</strong>{product.barcode && <small>Barcode: {product.barcode}</small>}</td>
                    <td data-label="หมวดหมู่">{product.category_name || '—'}</td>
                    <td data-label="SKU">{product.sku || '—'}</td>
                    <td data-label="หน่วย">{product.unit_abbreviation || product.unit_name || '—'}</td>
                    <td data-label="ต้นทุน">{formatCurrency(Number(product.cost_price))}</td>
                    <td data-label="ราคาขาย">{formatCurrency(Number(product.selling_price))}</td>
                    <td data-label="สถานะ"><span className={`status-pill ${product.is_active ? 'active' : 'inactive'}`}>{product.is_active ? 'เปิดขาย' : 'ปิดขาย'}</span></td>
                    {canManage && <td data-label="จัดการ"><div className="row-actions"><button className="action-button" onClick={() => openEditProduct(product)} type="button">แก้ไข</button><button className="action-button danger" disabled={isSaving} onClick={() => void handleDeleteProduct(product)} type="button">ลบ</button></div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isProductFormOpen && (
        <ProductFormModal
          categories={categories}
          isSaving={isSaving}
          onClose={() => setIsProductFormOpen(false)}
          onSave={handleSaveProduct}
          product={editingProduct}
          units={units}
        />
      )}
      {isCategoryManagerOpen && (
        <CategoryManagerModal
          canManage={canManage}
          categories={categories}
          isLoading={isLoading}
          isSaving={isSaving}
          onClose={() => setIsCategoryManagerOpen(false)}
          onDelete={handleDeleteCategory}
          onSave={handleSaveCategory}
        />
      )}
      {isUnitManagerOpen && (
        <UnitManagerModal
          canManage={canManage}
          isLoading={isLoading}
          isSaving={isSaving}
          onAddBasicUnits={handleAddBasicUnits}
          onClose={() => setIsUnitManagerOpen(false)}
          onDelete={handleDeleteUnit}
          onSave={handleSaveUnit}
          units={units}
        />
      )}
    </div>
  )
}
