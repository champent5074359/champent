import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ProductCategory, ProductInput, ProductRecord, ProductUnit } from '../services/productMaster'

type ProductFormModalProps = {
  categories: ProductCategory[]
  isSaving: boolean
  onClose: () => void
  onCreateCategory: (name: string) => Promise<ProductCategory>
  onCreateUnit: (name: string, abbreviation: string) => Promise<ProductUnit>
  onSave: (input: ProductInput) => Promise<void>
  product: ProductRecord | null
  products: ProductRecord[]
  units: ProductUnit[]
}

const emptyProduct: ProductInput = {
  barcode: '',
  categoryId: '',
  costPrice: 0,
  description: '',
  isActive: true,
  lowStockThreshold: 0,
  name: '',
  sellingPrice: 0,
  sku: '',
  trackStock: true,
  unitId: '',
}

export function ProductFormModal({
  categories,
  isSaving,
  onClose,
  onCreateCategory,
  onCreateUnit,
  onSave,
  product,
  products,
  units,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductInput>(emptyProduct)
  const [error, setError] = useState('')
  const [masterSuccess, setMasterSuccess] = useState('')
  const [quickCreate, setQuickCreate] = useState<'category' | 'unit' | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitAbbreviation, setNewUnitAbbreviation] = useState('')
  const operationInFlight = useRef(false)

  useEffect(() => {
    setForm(product ? {
      barcode: product.barcode ?? '',
      categoryId: product.category_id ?? '',
      costPrice: Number(product.cost_price),
      description: product.description ?? '',
      isActive: product.is_active,
      lowStockThreshold: Number(product.low_stock_threshold),
      name: product.name,
      sellingPrice: Number(product.selling_price),
      sku: product.sku ?? '',
      trackStock: product.track_stock,
      unitId: product.unit_id ?? '',
    } : emptyProduct)
    setError('')
    setMasterSuccess('')
    setQuickCreate(null)
  }, [product])

  function updateField<Key extends keyof ProductInput>(key: Key, value: ProductInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function showQuickCreate(kind: 'category' | 'unit') {
    if (isSaving || operationInFlight.current) return
    setQuickCreate(kind)
    setError('')
    setMasterSuccess('')
  }

  async function handleCreateCategory() {
    if (isSaving || operationInFlight.current) return
    const name = newCategoryName.trim()
    if (!name) {
      setError('กรุณากรอกชื่อหมวดหมู่')
      return
    }

    setError('')
    setMasterSuccess('')
    try {
      operationInFlight.current = true
      const created = await onCreateCategory(name)
      updateField('categoryId', created.id)
      setNewCategoryName('')
      setQuickCreate(null)
      setMasterSuccess(`สร้างหมวดหมู่ “${created.name}” และเลือกให้อัตโนมัติแล้ว`)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถสร้างหมวดหมู่ได้')
    } finally {
      operationInFlight.current = false
    }
  }

  async function handleCreateUnit() {
    if (isSaving || operationInFlight.current) return
    const name = newUnitName.trim()
    if (!name) {
      setError('กรุณากรอกชื่อหน่วยนับ')
      return
    }

    setError('')
    setMasterSuccess('')
    try {
      operationInFlight.current = true
      const created = await onCreateUnit(name, newUnitAbbreviation.trim())
      updateField('unitId', created.id)
      setNewUnitName('')
      setNewUnitAbbreviation('')
      setQuickCreate(null)
      setMasterSuccess(`สร้างหน่วยนับ “${created.name}” และเลือกให้อัตโนมัติแล้ว`)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถสร้างหน่วยนับได้')
    } finally {
      operationInFlight.current = false
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || operationInFlight.current) return

    setError('')
    setMasterSuccess('')
    const normalizedName = form.name.trim()
    const normalizedSku = form.sku.trim().toLocaleLowerCase('th')
    const normalizedBarcode = form.barcode.trim()

    if (!normalizedName) {
      setError('กรุณากรอกชื่อสินค้า')
      return
    }
    if (!Number.isFinite(form.costPrice) || form.costPrice < 0) {
      setError('ราคาต้นทุนต้องเป็นศูนย์หรือมากกว่า')
      return
    }
    if (!Number.isFinite(form.sellingPrice) || form.sellingPrice < 0) {
      setError('ราคาขายต้องเป็นศูนย์หรือมากกว่า')
      return
    }
    if (!Number.isFinite(form.lowStockThreshold) || form.lowStockThreshold < 0) {
      setError('จุดแจ้งเตือนสินค้าใกล้หมดต้องเป็นศูนย์หรือมากกว่า')
      return
    }
    if (normalizedSku && products.some((item) => (
      item.id !== product?.id && item.sku?.trim().toLocaleLowerCase('th') === normalizedSku
    ))) {
      setError('SKU นี้ถูกใช้แล้ว')
      return
    }
    if (normalizedBarcode && products.some((item) => (
      item.id !== product?.id && item.barcode?.trim() === normalizedBarcode
    ))) {
      setError('Barcode นี้ถูกใช้แล้ว')
      return
    }

    try {
      operationInFlight.current = true
      await onSave({
        ...form,
        barcode: normalizedBarcode,
        description: form.description.trim(),
        name: normalizedName,
        sku: form.sku.trim(),
      })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถบันทึกสินค้าได้')
    } finally {
      operationInFlight.current = false
    }
  }

  const isMissingMasterData = categories.length === 0 || units.length === 0

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="product-form-title" aria-modal="true" className="modal-card product-form-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Product Master</p>
            <h2 id="product-form-title">{product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2>
            <p className="product-form-intro">บันทึกข้อมูลหลักของสินค้า โดยยังไม่คำนวณสต๊อกคงเหลือหรือกำไร</p>
          </div>
          <button aria-label="ปิดแบบฟอร์ม" className="modal-close" disabled={isSaving} onClick={onClose} type="button">×</button>
        </div>

        {isMissingMasterData && (
          <div className="product-prerequisite" role="status">
            <strong>เตรียมข้อมูลก่อนเพิ่มสินค้า</strong>
            {categories.length === 0 && <span>ยังไม่มีหมวดหมู่สินค้า</span>}
            {units.length === 0 && <span>ยังไม่มีหน่วยนับสินค้า</span>}
            <div>
              {categories.length === 0 && <button className="text-button" disabled={isSaving} onClick={() => showQuickCreate('category')} type="button">สร้างหมวดหมู่</button>}
              {units.length === 0 && <button className="text-button" disabled={isSaving} onClick={() => showQuickCreate('unit')} type="button">สร้างหน่วยนับ</button>}
            </div>
          </div>
        )}

        <form className="product-form" onSubmit={handleSubmit}>
          <label className="form-field field-span-2">
            ชื่อสินค้า <span aria-hidden="true">*</span>
            <input autoFocus disabled={isSaving} onChange={(event) => updateField('name', event.target.value)} placeholder="เช่น เสื้อยืดคอกลม" required value={form.name} />
          </label>

          <div className="product-master-field">
            <label className="form-field">
              หมวดหมู่
              <select disabled={isSaving} onChange={(event) => updateField('categoryId', event.target.value)} value={form.categoryId}>
                <option value="">ไม่ระบุหมวดหมู่</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.is_active ? '' : ' (ปิดใช้งาน)'}</option>)}
              </select>
            </label>
            <button className="inline-create-button" disabled={isSaving} onClick={() => showQuickCreate('category')} type="button">+ สร้างหมวดหมู่ใหม่</button>
          </div>
          <div className="product-master-field">
            <label className="form-field">
              หน่วยนับ
              <select disabled={isSaving} onChange={(event) => updateField('unitId', event.target.value)} value={form.unitId}>
                <option value="">ไม่ระบุหน่วยนับ</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.abbreviation ? ` (${unit.abbreviation})` : ''}{unit.is_active ? '' : ' (ปิดใช้งาน)'}</option>)}
              </select>
            </label>
            <button className="inline-create-button" disabled={isSaving} onClick={() => showQuickCreate('unit')} type="button">+ สร้างหน่วยนับใหม่</button>
          </div>

          {quickCreate === 'category' && (
            <div className="quick-master-form field-span-2">
              <div>
                <strong>สร้างหมวดหมู่จากฟอร์มสินค้า</strong>
                <span>ระบบจะเลือกหมวดหมู่ใหม่ให้อัตโนมัติ</span>
              </div>
              <label className="form-field">
                ชื่อหมวดหมู่ <span aria-hidden="true">*</span>
                <input disabled={isSaving} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="เช่น เครื่องดื่ม" value={newCategoryName} />
              </label>
              <div className="quick-master-actions">
                <button className="text-button" disabled={isSaving} onClick={() => setQuickCreate(null)} type="button">ยกเลิก</button>
                <button className="secondary-button" disabled={isSaving} onClick={() => void handleCreateCategory()} type="button">{isSaving ? 'กำลังสร้าง…' : 'สร้างหมวดหมู่'}</button>
              </div>
            </div>
          )}

          {quickCreate === 'unit' && (
            <div className="quick-master-form field-span-2">
              <div>
                <strong>สร้างหน่วยนับจากฟอร์มสินค้า</strong>
                <span>ระบบจะเลือกหน่วยนับใหม่ให้อัตโนมัติ</span>
              </div>
              <div className="quick-unit-fields">
                <label className="form-field">
                  ชื่อหน่วยนับ <span aria-hidden="true">*</span>
                  <input disabled={isSaving} onChange={(event) => setNewUnitName(event.target.value)} placeholder="เช่น ชิ้น" value={newUnitName} />
                </label>
                <label className="form-field">
                  ตัวย่อ
                  <input disabled={isSaving} onChange={(event) => setNewUnitAbbreviation(event.target.value)} placeholder="เช่น ชิ้น หรือ กก." value={newUnitAbbreviation} />
                </label>
              </div>
              <div className="quick-master-actions">
                <button className="text-button" disabled={isSaving} onClick={() => setQuickCreate(null)} type="button">ยกเลิก</button>
                <button className="secondary-button" disabled={isSaving} onClick={() => void handleCreateUnit()} type="button">{isSaving ? 'กำลังสร้าง…' : 'สร้างหน่วยนับ'}</button>
              </div>
            </div>
          )}

          <label className="form-field">
            SKU
            <input disabled={isSaving} onChange={(event) => updateField('sku', event.target.value)} placeholder="เช่น TSHIRT-001" value={form.sku} />
          </label>
          <label className="form-field">
            Barcode
            <input disabled={isSaving} inputMode="numeric" onChange={(event) => updateField('barcode', event.target.value)} placeholder="เช่น 885000000001" value={form.barcode} />
          </label>
          <label className="form-field">
            ราคาต้นทุน
            <input disabled={isSaving} min="0" onChange={(event) => updateField('costPrice', Number(event.target.value))} step="0.01" type="number" value={form.costPrice} />
          </label>
          <label className="form-field">
            ราคาขาย
            <input disabled={isSaving} min="0" onChange={(event) => updateField('sellingPrice', Number(event.target.value))} step="0.01" type="number" value={form.sellingPrice} />
          </label>
          <label className="form-field field-span-2">
            รายละเอียด
            <textarea disabled={isSaving} onChange={(event) => updateField('description', event.target.value)} placeholder="รายละเอียดเพิ่มเติมของสินค้า" rows={3} value={form.description} />
          </label>
          <label className="form-field">
            จุดแจ้งเตือนสินค้าใกล้หมด
            <input disabled={isSaving || !form.trackStock} min="0" onChange={(event) => updateField('lowStockThreshold', Number(event.target.value))} step="0.001" type="number" value={form.lowStockThreshold} />
          </label>
          <div className="product-toggles">
            <label className="toggle-field">
              <input checked={form.trackStock} disabled={isSaving} onChange={(event) => updateField('trackStock', event.target.checked)} type="checkbox" />
              ติดตามสต๊อก
            </label>
            <label className="toggle-field">
              <input checked={form.isActive} disabled={isSaving} onChange={(event) => updateField('isActive', event.target.checked)} type="checkbox" />
              เปิดใช้งานสินค้า
            </label>
          </div>
          {error && <p className="form-error field-span-2" role="alert">{error}</p>}
          {masterSuccess && <p className="form-success field-span-2" role="status">{masterSuccess}</p>}
          <div className="modal-actions field-span-2">
            <button className="secondary-button" disabled={isSaving} onClick={onClose} type="button">ยกเลิก</button>
            <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'กำลังบันทึก…' : product ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
