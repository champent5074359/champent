import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ProductUnit, UnitInput } from '../services/productMaster'

type UnitManagerModalProps = {
  canManage: boolean
  isLoading: boolean
  isSaving: boolean
  onAddBasicUnits: () => Promise<number>
  onClose: () => void
  onDelete: (unit: ProductUnit) => Promise<void>
  onSave: (input: UnitInput, unitId?: string) => Promise<void>
  units: ProductUnit[]
}

const emptyForm: UnitInput = {
  abbreviation: '',
  isActive: true,
  name: '',
}

export function UnitManagerModal({
  canManage,
  isLoading,
  isSaving,
  onAddBasicUnits,
  onClose,
  onDelete,
  onSave,
  units,
}: UnitManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UnitInput>(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const operationInFlight = useRef(false)

  useEffect(() => {
    if (editingId && !units.some((unit) => unit.id === editingId)) {
      resetForm()
    }
  }, [editingId, units])

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  function startEdit(unit: ProductUnit) {
    setEditingId(unit.id)
    setForm({
      abbreviation: unit.abbreviation ?? '',
      isActive: unit.is_active,
      name: unit.name,
    })
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage || isSaving || operationInFlight.current) return

    setError('')
    setSuccess('')
    const normalizedName = form.name.trim().toLocaleLowerCase('th')

    if (!normalizedName) {
      setError('กรุณากรอกชื่อหน่วยนับ')
      return
    }

    const isDuplicate = units.some((unit) => (
      unit.id !== editingId
      && unit.name.trim().toLocaleLowerCase('th') === normalizedName
    ))

    if (isDuplicate) {
      setError('ชื่อหน่วยนับนี้มีอยู่แล้ว')
      return
    }

    try {
      operationInFlight.current = true
      const wasEditing = Boolean(editingId)
      await onSave(form, editingId ?? undefined)
      resetForm()
      setSuccess(wasEditing ? 'แก้ไขหน่วยนับเรียบร้อยแล้ว' : 'เพิ่มหน่วยนับเรียบร้อยแล้ว')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถบันทึกหน่วยนับได้')
    } finally {
      operationInFlight.current = false
    }
  }

  async function handleDelete(unit: ProductUnit) {
    if (!canManage || isSaving || operationInFlight.current) return
    if (!window.confirm(`ต้องการลบหน่วยนับ “${unit.name}” หรือไม่? ข้อมูลจะถูกซ่อนแบบ Soft Delete`)) {
      return
    }

    setError('')
    setSuccess('')
    try {
      operationInFlight.current = true
      await onDelete(unit)
      if (editingId === unit.id) resetForm()
      setSuccess('ลบหน่วยนับเรียบร้อยแล้ว')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถลบหน่วยนับได้')
    } finally {
      operationInFlight.current = false
    }
  }

  async function handleAddBasicUnits() {
    if (!canManage || isSaving || operationInFlight.current) return
    if (!window.confirm('ต้องการเพิ่มหน่วยพื้นฐานหรือไม่? ระบบจะข้ามชื่อหน่วยนับที่มีอยู่แล้ว')) {
      return
    }

    setError('')
    setSuccess('')
    try {
      operationInFlight.current = true
      const createdCount = await onAddBasicUnits()
      setSuccess(createdCount > 0
        ? `เพิ่มหน่วยพื้นฐานเรียบร้อยแล้ว ${createdCount} รายการ`
        : 'มีหน่วยพื้นฐานครบแล้ว ไม่มีรายการที่ต้องเพิ่ม')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถเพิ่มหน่วยพื้นฐานได้')
    } finally {
      operationInFlight.current = false
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="unit-manager-title" aria-modal="true" className="modal-card unit-manager-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ตั้งค่าข้อมูลสินค้า</p>
            <h2 id="unit-manager-title">จัดการหน่วยนับ</h2>
            <p className="unit-manager-intro">กำหนดชื่อ ตัวย่อ และสถานะหน่วยนับที่ใช้กับสินค้าในธุรกิจปัจจุบัน</p>
          </div>
          <button aria-label="ปิดหน้าต่าง" className="modal-close" disabled={isSaving} onClick={onClose} type="button">×</button>
        </div>

        {!canManage && (
          <p className="permission-notice">บัญชี staff สามารถดูหน่วยนับสินค้าได้อย่างเดียว</p>
        )}

        {canManage && (
          <>
            <form className="unit-form" onSubmit={handleSubmit}>
              <label className="form-field">
                ชื่อหน่วยนับ <span>*</span>
                <input
                  disabled={isSaving}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="เช่น ชิ้น"
                  required
                  value={form.name}
                />
              </label>
              <label className="form-field">
                ตัวย่อ
                <input
                  disabled={isSaving}
                  onChange={(event) => setForm((current) => ({ ...current, abbreviation: event.target.value }))}
                  placeholder="เช่น ชิ้น หรือ กก."
                  value={form.abbreviation}
                />
              </label>
              <label className="toggle-field unit-active-field field-span-2">
                <input
                  checked={form.isActive}
                  disabled={isSaving}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  type="checkbox"
                />
                เปิดใช้งานหน่วยนับนี้
              </label>
              <div className="unit-form-actions field-span-2">
                {editingId && (
                  <button className="text-button" disabled={isSaving} onClick={resetForm} type="button">ยกเลิกแก้ไข</button>
                )}
                <button className="primary-button" disabled={isSaving} type="submit">
                  {isSaving ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มหน่วยนับ'}
                </button>
              </div>
            </form>
            <div className="unit-basic-actions">
              <div>
                <strong>หน่วยพื้นฐาน</strong>
                <span>ชิ้น กล่อง ถุง ขวด ชุด แพ็ค กรัม กิโลกรัม ลิตร และมิลลิลิตร</span>
              </div>
              <button className="secondary-button" disabled={isSaving} onClick={() => void handleAddBasicUnits()} type="button">
                {isSaving ? 'กำลังเพิ่ม…' : 'เพิ่มหน่วยพื้นฐาน'}
              </button>
            </div>
          </>
        )}

        {error && <p className="form-error unit-message" role="alert">{error}</p>}
        {success && <p className="form-success unit-message" role="status">{success}</p>}

        <div className="unit-list-heading">
          <strong>รายการหน่วยนับ</strong>
          <span>{units.length} รายการ</span>
        </div>
        <div className="unit-list" aria-live="polite">
          {isLoading ? (
            <p className="compact-empty">กำลังโหลดหน่วยนับ…</p>
          ) : units.length === 0 ? (
            <p className="compact-empty">ยังไม่มีหน่วยนับสินค้า</p>
          ) : units.map((unit) => (
            <article className="unit-row" key={unit.id}>
              <div className="unit-row-content">
                <div className="unit-row-title">
                  <strong>{unit.name}</strong>
                  <span className={`status-pill ${unit.is_active ? 'active' : 'inactive'}`}>
                    {unit.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </div>
                <p>ตัวย่อ: {unit.abbreviation || '—'}</p>
              </div>
              {canManage && (
                <div className="row-actions">
                  <button className="action-button" disabled={isSaving} onClick={() => startEdit(unit)} type="button">แก้ไข</button>
                  <button className="action-button danger" disabled={isSaving} onClick={() => void handleDelete(unit)} type="button">ลบ</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
