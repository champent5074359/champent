import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { CategoryInput, ProductCategory, ProductUnit, UnitInput } from '../services/productMaster'

export type MasterDataKind = 'category' | 'unit'

type MasterDataManagerModalProps = {
  categories: ProductCategory[]
  isSaving: boolean
  kind: MasterDataKind
  onClose: () => void
  onDeleteCategory: (category: ProductCategory) => Promise<void>
  onDeleteUnit: (unit: ProductUnit) => Promise<void>
  onSaveCategory: (input: CategoryInput, categoryId?: string) => Promise<void>
  onSaveUnit: (input: UnitInput, unitId?: string) => Promise<void>
  units: ProductUnit[]
}

export function MasterDataManagerModal(props: MasterDataManagerModalProps) {
  const { categories, isSaving, kind, onClose, onDeleteCategory, onDeleteUnit, onSaveCategory, onSaveUnit, units } = props
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [secondary, setSecondary] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [error, setError] = useState('')
  const items = kind === 'category' ? categories : units
  const noun = kind === 'category' ? 'หมวดหมู่' : 'หน่วยนับ'

  useEffect(() => {
    setEditingId(null)
    setName('')
    setSecondary('')
    setSortOrder(0)
    setError('')
  }, [kind])

  function resetForm() {
    setEditingId(null)
    setName('')
    setSecondary('')
    setSortOrder(0)
    setError('')
  }

  function startEdit(item: ProductCategory | ProductUnit) {
    setEditingId(item.id)
    setName(item.name)
    if (kind === 'category') {
      const category = item as ProductCategory
      setSecondary(category.description ?? '')
      setSortOrder(category.sort_order)
    } else {
      setSecondary((item as ProductUnit).abbreviation ?? '')
    }
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const normalizedName = name.trim().toLocaleLowerCase('th')
    const duplicate = items.some((item) => item.id !== editingId && item.name.trim().toLocaleLowerCase('th') === normalizedName)

    if (!normalizedName) {
      setError(`กรุณากรอกชื่อ${noun}`)
      return
    }
    if (duplicate) {
      setError(`ชื่อ${noun}นี้มีอยู่แล้ว`)
      return
    }

    try {
      if (kind === 'category') {
        const category = categories.find((item) => item.id === editingId)
        await onSaveCategory({ description: secondary, isActive: category?.is_active ?? true, name, sortOrder }, editingId ?? undefined)
      } else {
        await onSaveUnit({ abbreviation: secondary, name }, editingId ?? undefined)
      }
      resetForm()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `ไม่สามารถบันทึก${noun}ได้`)
    }
  }

  async function handleDelete(item: ProductCategory | ProductUnit) {
    if (!window.confirm(`ต้องการลบ${noun} “${item.name}” หรือไม่? ข้อมูลจะถูกซ่อนแบบ Soft Delete`)) {
      return
    }

    setError('')
    try {
      if (kind === 'category') {
        await onDeleteCategory(item as ProductCategory)
      } else {
        await onDeleteUnit(item as ProductUnit)
      }
      if (editingId === item.id) {
        resetForm()
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `ไม่สามารถลบ${noun}ได้`)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="master-data-title" aria-modal="true" className="modal-card master-data-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ตั้งค่าข้อมูลสินค้า</p>
            <h2 id="master-data-title">จัดการ{noun}</h2>
          </div>
          <button aria-label="ปิดหน้าต่าง" className="modal-close" disabled={isSaving} onClick={onClose} type="button">×</button>
        </div>

        <form className="master-data-form" onSubmit={handleSubmit}>
          <label className="form-field">
            ชื่อ{noun}
            <input onChange={(event) => setName(event.target.value)} placeholder={kind === 'category' ? 'เช่น เครื่องดื่ม' : 'เช่น ชิ้น'} required value={name} />
          </label>
          <label className="form-field">
            {kind === 'category' ? 'รายละเอียด' : 'ตัวย่อ'}
            <input onChange={(event) => setSecondary(event.target.value)} placeholder={kind === 'category' ? 'รายละเอียดหมวดหมู่' : 'เช่น ชิ้น, กก.'} value={secondary} />
          </label>
          {kind === 'category' && (
            <label className="form-field compact-field">
              ลำดับ
              <input onChange={(event) => setSortOrder(Number(event.target.value))} step="1" type="number" value={sortOrder} />
            </label>
          )}
          <div className="master-form-actions">
            {editingId && <button className="text-button" disabled={isSaving} onClick={resetForm} type="button">ยกเลิกแก้ไข</button>}
            <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : `เพิ่ม${noun}`}</button>
          </div>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="master-data-list">
          {items.length === 0 ? (
            <p className="compact-empty">ยังไม่มี{noun}</p>
          ) : items.map((item) => (
            <div className="master-data-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>{kind === 'category' ? (item as ProductCategory).description || 'ไม่มีรายละเอียด' : (item as ProductUnit).abbreviation || 'ไม่มีตัวย่อ'}</small>
              </div>
              <div className="row-actions">
                <button className="action-button" disabled={isSaving} onClick={() => startEdit(item)} type="button">แก้ไข</button>
                <button className="action-button danger" disabled={isSaving} onClick={() => void handleDelete(item)} type="button">ลบ</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
