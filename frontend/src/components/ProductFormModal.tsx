import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { ProductCategory, ProductInput, ProductRecord, ProductUnit } from '../services/productMaster'

type ProductFormModalProps = {
  categories: ProductCategory[]
  isSaving: boolean
  onClose: () => void
  onSave: (input: ProductInput) => Promise<void>
  product: ProductRecord | null
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

export function ProductFormModal({ categories, isSaving, onClose, onSave, product, units }: ProductFormModalProps) {
  const [form, setForm] = useState<ProductInput>(emptyProduct)
  const [error, setError] = useState('')

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
  }, [product])

  function updateField<Key extends keyof ProductInput>(key: Key, value: ProductInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('กรุณากรอกชื่อสินค้า')
      return
    }

    if (form.costPrice < 0 || form.sellingPrice < 0 || form.lowStockThreshold < 0) {
      setError('ราคาและจุดแจ้งเตือนต้องเป็นศูนย์หรือมากกว่า')
      return
    }

    try {
      await onSave(form)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถบันทึกสินค้าได้')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="product-form-title" aria-modal="true" className="modal-card product-form-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Product Master</p>
            <h2 id="product-form-title">{product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2>
          </div>
          <button aria-label="ปิดแบบฟอร์ม" className="modal-close" disabled={isSaving} onClick={onClose} type="button">×</button>
        </div>

        <form className="product-form" onSubmit={handleSubmit}>
          <label className="form-field field-span-2">
            ชื่อสินค้า <span aria-hidden="true">*</span>
            <input autoFocus onChange={(event) => updateField('name', event.target.value)} placeholder="เช่น เสื้อยืดคอกลม" required value={form.name} />
          </label>
          <label className="form-field">
            หมวดหมู่
            <select onChange={(event) => updateField('categoryId', event.target.value)} value={form.categoryId}>
              <option value="">ไม่ระบุหมวดหมู่</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.is_active ? '' : ' (ปิดใช้งาน)'}</option>)}
            </select>
          </label>
          <label className="form-field">
            หน่วยนับ
            <select onChange={(event) => updateField('unitId', event.target.value)} value={form.unitId}>
              <option value="">ไม่ระบุหน่วยนับ</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.abbreviation ? ` (${unit.abbreviation})` : ''}</option>)}
            </select>
          </label>
          <label className="form-field">
            SKU
            <input onChange={(event) => updateField('sku', event.target.value)} placeholder="เช่น TSHIRT-001" value={form.sku} />
          </label>
          <label className="form-field">
            Barcode
            <input inputMode="numeric" onChange={(event) => updateField('barcode', event.target.value)} placeholder="เช่น 885000000001" value={form.barcode} />
          </label>
          <label className="form-field">
            ต้นทุน
            <input min="0" onChange={(event) => updateField('costPrice', Number(event.target.value))} step="0.01" type="number" value={form.costPrice} />
          </label>
          <label className="form-field">
            ราคาขาย
            <input min="0" onChange={(event) => updateField('sellingPrice', Number(event.target.value))} step="0.01" type="number" value={form.sellingPrice} />
          </label>
          <label className="form-field field-span-2">
            รายละเอียด
            <textarea onChange={(event) => updateField('description', event.target.value)} placeholder="รายละเอียดเพิ่มเติมของสินค้า" rows={3} value={form.description} />
          </label>
          <label className="form-field">
            จุดแจ้งเตือนสินค้าใกล้หมด
            <input disabled={!form.trackStock} min="0" onChange={(event) => updateField('lowStockThreshold', Number(event.target.value))} step="0.001" type="number" value={form.lowStockThreshold} />
          </label>
          <div className="product-toggles">
            <label className="toggle-field">
              <input checked={form.trackStock} onChange={(event) => updateField('trackStock', event.target.checked)} type="checkbox" />
              ติดตามสต๊อก
            </label>
            <label className="toggle-field">
              <input checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} type="checkbox" />
              เปิดขาย
            </label>
          </div>
          {error && <p className="form-error field-span-2" role="alert">{error}</p>}
          <div className="modal-actions field-span-2">
            <button className="secondary-button" disabled={isSaving} onClick={onClose} type="button">ยกเลิก</button>
            <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'กำลังบันทึก…' : 'บันทึกสินค้า'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
