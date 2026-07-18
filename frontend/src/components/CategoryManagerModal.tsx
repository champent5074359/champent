import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { CategoryInput, ProductCategory } from '../services/productMaster'

type CategoryManagerModalProps = {
  canManage: boolean
  categories: ProductCategory[]
  isLoading: boolean
  isSaving: boolean
  onClose: () => void
  onDelete: (category: ProductCategory) => Promise<void>
  onSave: (input: CategoryInput, categoryId?: string) => Promise<void>
}

const emptyForm: CategoryInput = {
  description: '',
  isActive: true,
  name: '',
  sortOrder: 0,
}

export function CategoryManagerModal({
  canManage,
  categories,
  isLoading,
  isSaving,
  onClose,
  onDelete,
  onSave,
}: CategoryManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryInput>(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (editingId && !categories.some((category) => category.id === editingId)) {
      resetForm()
    }
  }, [categories, editingId])

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  function startEdit(category: ProductCategory) {
    setEditingId(category.id)
    setForm({
      description: category.description ?? '',
      isActive: category.is_active,
      name: category.name,
      sortOrder: category.sort_order,
    })
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage || isSaving) return

    setError('')
    setSuccess('')
    const normalizedName = form.name.trim().toLocaleLowerCase('th')

    if (!normalizedName) {
      setError('กรุณากรอกชื่อหมวดหมู่')
      return
    }

    const isDuplicate = categories.some((category) => (
      category.id !== editingId
      && category.name.trim().toLocaleLowerCase('th') === normalizedName
    ))

    if (isDuplicate) {
      setError('ชื่อหมวดหมู่นี้มีอยู่แล้ว')
      return
    }

    try {
      const wasEditing = Boolean(editingId)
      await onSave(form, editingId ?? undefined)
      resetForm()
      setSuccess(wasEditing ? 'แก้ไขหมวดหมู่เรียบร้อยแล้ว' : 'เพิ่มหมวดหมู่เรียบร้อยแล้ว')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถบันทึกหมวดหมู่ได้')
    }
  }

  async function handleDelete(category: ProductCategory) {
    if (!canManage || isSaving) return
    if (!window.confirm(`ต้องการลบหมวดหมู่ “${category.name}” หรือไม่? ข้อมูลจะถูกซ่อนแบบ Soft Delete`)) {
      return
    }

    setError('')
    setSuccess('')
    try {
      await onDelete(category)
      if (editingId === category.id) resetForm()
      setSuccess('ลบหมวดหมู่เรียบร้อยแล้ว')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถลบหมวดหมู่ได้')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="category-manager-title" aria-modal="true" className="modal-card category-manager-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ตั้งค่าข้อมูลสินค้า</p>
            <h2 id="category-manager-title">จัดการหมวดหมู่</h2>
            <p className="category-manager-intro">จัดกลุ่มสินค้าและกำหนดลำดับที่ใช้แสดงในธุรกิจปัจจุบัน</p>
          </div>
          <button aria-label="ปิดหน้าต่าง" className="modal-close" disabled={isSaving} onClick={onClose} type="button">×</button>
        </div>

        {!canManage && (
          <p className="permission-notice">บัญชี staff สามารถดูหมวดหมู่สินค้าได้อย่างเดียว</p>
        )}

        {canManage && (
          <form className="category-form" onSubmit={handleSubmit}>
            <label className="form-field">
              ชื่อหมวดหมู่ <span>*</span>
              <input
                disabled={isSaving}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="เช่น เครื่องดื่ม"
                required
                value={form.name}
              />
            </label>
            <label className="form-field field-span-2">
              รายละเอียด
              <textarea
                disabled={isSaving}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="อธิบายหมวดหมู่นี้โดยย่อ"
                rows={2}
                value={form.description}
              />
            </label>
            <label className="form-field">
              ลำดับการแสดง
              <input
                disabled={isSaving}
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
                step="1"
                type="number"
                value={form.sortOrder}
              />
            </label>
            <label className="toggle-field category-active-field">
              <input
                checked={form.isActive}
                disabled={isSaving}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
              เปิดใช้งานหมวดหมู่นี้
            </label>
            <div className="category-form-actions field-span-2">
              {editingId && (
                <button className="text-button" disabled={isSaving} onClick={resetForm} type="button">ยกเลิกแก้ไข</button>
              )}
              <button className="primary-button" disabled={isSaving} type="submit">
                {isSaving ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มหมวดหมู่'}
              </button>
            </div>
          </form>
        )}

        {error && <p className="form-error category-message" role="alert">{error}</p>}
        {success && <p className="form-success category-message" role="status">{success}</p>}

        <div className="category-list-heading">
          <strong>รายการหมวดหมู่</strong>
          <span>{categories.length} รายการ</span>
        </div>
        <div className="category-list" aria-live="polite">
          {isLoading ? (
            <p className="compact-empty">กำลังโหลดหมวดหมู่…</p>
          ) : categories.length === 0 ? (
            <p className="compact-empty">ยังไม่มีหมวดหมู่สินค้า</p>
          ) : categories.map((category) => (
            <article className="category-row" key={category.id}>
              <div className="category-row-content">
                <div className="category-row-title">
                  <strong>{category.name}</strong>
                  <span className={`status-pill ${category.is_active ? 'active' : 'inactive'}`}>
                    {category.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </div>
                <p>{category.description || 'ไม่มีรายละเอียด'}</p>
                <small>ลำดับการแสดง: {category.sort_order}</small>
              </div>
              {canManage && (
                <div className="row-actions">
                  <button className="action-button" disabled={isSaving} onClick={() => startEdit(category)} type="button">แก้ไข</button>
                  <button className="action-button danger" disabled={isSaving} onClick={() => void handleDelete(category)} type="button">ลบ</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
