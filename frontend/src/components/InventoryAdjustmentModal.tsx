import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { InventoryItem, InventoryMovementType } from '../services/inventory'

type InventoryAdjustmentModalProps = {
  isSaving: boolean
  item: InventoryItem
  onClose: () => void
  onSave: (input: {
    movementType: InventoryMovementType
    notes: string
    quantity: number
    reason: string
  }) => Promise<void>
}

const movementOptions: Array<{
  description: string
  label: string
  type: InventoryMovementType
}> = [
  {
    description: 'กำหนดยอดเริ่มต้นได้ครั้งเดียวต่อสินค้าและสาขา',
    label: 'ยอดตั้งต้น',
    type: 'opening_balance',
  },
  {
    description: 'เพิ่มจำนวนเข้าสู่สต๊อกด้วยค่ามากกว่า 0',
    label: 'ปรับเพิ่ม',
    type: 'adjustment_in',
  },
  {
    description: 'ระบุจำนวนที่นำออก ระบบจะหักจากยอดคงเหลือ',
    label: 'ปรับลด',
    type: 'adjustment_out',
  },
  {
    description: 'ระบุยอดคงเหลือจริงหลังตรวจนับตั้งแต่ 0 ขึ้นไป',
    label: 'ตรวจนับสต๊อก',
    type: 'stock_count',
  },
]

const quantityFormatter = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 3,
})

export function InventoryAdjustmentModal({
  isSaving,
  item,
  onClose,
  onSave,
}: InventoryAdjustmentModalProps) {
  const [movementType, setMovementType] = useState<InventoryMovementType>('adjustment_in')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const operationInFlight = useRef(false)

  useEffect(() => {
    setMovementType(item.last_movement_at ? 'adjustment_in' : 'opening_balance')
    setQuantity('')
    setReason('')
    setNotes('')
    setError('')
  }, [item])

  const movement = movementOptions.find((option) => option.type === movementType) ?? movementOptions[0]
  const quantityLabel = movementType === 'stock_count'
    ? 'ยอดคงเหลือจริงหลังตรวจนับ'
    : movementType === 'opening_balance'
      ? 'ยอดตั้งต้น'
      : 'จำนวนที่ต้องการปรับ'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || operationInFlight.current) return

    setError('')
    const parsedQuantity = Number(quantity)
    const normalizedReason = reason.trim()
    const allowsZero = movementType === 'opening_balance' || movementType === 'stock_count'

    if (quantity.trim() === '' || !Number.isFinite(parsedQuantity)) {
      setError('กรุณาระบุจำนวนให้ถูกต้อง')
      return
    }
    if ((allowsZero && parsedQuantity < 0) || (!allowsZero && parsedQuantity <= 0)) {
      setError(allowsZero ? 'จำนวนต้องเป็นศูนย์หรือมากกว่า' : 'จำนวนต้องมากกว่า 0')
      return
    }
    if (!normalizedReason) {
      setError('กรุณาระบุเหตุผล')
      return
    }
    if (normalizedReason.length > 500) {
      setError('เหตุผลต้องไม่เกิน 500 ตัวอักษร')
      return
    }

    try {
      operationInFlight.current = true
      await onSave({
        movementType,
        notes: notes.trim(),
        quantity: parsedQuantity,
        reason: normalizedReason,
      })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถปรับสต๊อกได้')
    } finally {
      operationInFlight.current = false
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="inventory-adjustment-title" aria-modal="true" className="modal-card inventory-adjustment-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2 id="inventory-adjustment-title">ปรับสต๊อก</h2>
            <p className="product-form-intro">{item.product_name} · {item.branch_name}</p>
          </div>
          <button aria-label="ปิดแบบฟอร์มปรับสต๊อก" className="modal-close" disabled={isSaving} onClick={onClose} type="button">×</button>
        </div>

        <div className="inventory-current-balance" aria-label="ยอดสต๊อกปัจจุบัน">
          <span>คงเหลือ <strong>{quantityFormatter.format(item.quantity)}</strong></span>
          <span>จอง <strong>{quantityFormatter.format(item.reserved_quantity)}</strong></span>
          <span>พร้อมขาย <strong>{quantityFormatter.format(item.available_quantity)}</strong></span>
        </div>

        <form className="inventory-adjustment-form" onSubmit={handleSubmit}>
          <label className="form-field">
            ประเภทรายการ <span aria-hidden="true">*</span>
            <select disabled={isSaving} onChange={(event) => setMovementType(event.target.value as InventoryMovementType)} value={movementType}>
              {movementOptions.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}
            </select>
          </label>
          <p className="movement-help">{movement.description}</p>

          <label className="form-field">
            {quantityLabel} <span aria-hidden="true">*</span>
            <input
              autoFocus
              disabled={isSaving}
              inputMode="decimal"
              min={movementType === 'adjustment_in' || movementType === 'adjustment_out' ? '0.001' : '0'}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="0.000"
              step="0.001"
              type="number"
              value={quantity}
            />
          </label>
          <label className="form-field">
            เหตุผล <span aria-hidden="true">*</span>
            <input disabled={isSaving} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="เช่น ตรวจรับสินค้าเข้าคลัง" value={reason} />
          </label>
          <label className="form-field">
            หมายเหตุ
            <textarea disabled={isSaving} onChange={(event) => setNotes(event.target.value)} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" rows={3} value={notes} />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="secondary-button" disabled={isSaving} onClick={onClose} type="button">ยกเลิก</button>
            <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'กำลังบันทึก…' : 'ยืนยันปรับสต๊อก'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
