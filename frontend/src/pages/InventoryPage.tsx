import { useCallback, useEffect, useMemo, useState } from 'react'
import { InventoryAdjustmentModal } from '../components/InventoryAdjustmentModal'
import { useDashboardContext } from '../hooks/useDashboardContext'
import { adjustInventory, loadInventoryData } from '../services/inventory'
import type {
  InventoryAdjustmentInput,
  InventoryData,
  InventoryItem,
  InventoryMovementType,
} from '../services/inventory'

const quantityFormatter = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 3,
})

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const movementLabels: Record<InventoryMovementType, string> = {
  adjustment_in: 'ปรับเพิ่ม',
  adjustment_out: 'ปรับลด',
  opening_balance: 'ยอดตั้งต้น',
  stock_count: 'ตรวจนับสต๊อก',
}

function isLowStock(item: InventoryItem) {
  return item.available_quantity <= item.low_stock_threshold
}

function getStockStatus(item: InventoryItem) {
  if (item.available_quantity <= 0) {
    return { className: 'out', label: 'หมด' }
  }
  if (isLowStock(item)) {
    return { className: 'low', label: 'ใกล้หมด' }
  }
  return { className: 'healthy', label: 'ปกติ' }
}

function InventoryStatus({ item }: { item: InventoryItem }) {
  const status = getStockStatus(item)
  return <span className={`status-pill stock-${status.className}`}>{status.label}</span>
}

export function InventoryPage() {
  const { data: workspace, error: workspaceError, isLoading: isWorkspaceLoading } = useDashboardContext()
  const [inventory, setInventory] = useState<InventoryData | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null)
  const canManage = workspace?.memberRole === 'owner' || workspace?.memberRole === 'manager'

  const refreshData = useCallback(async () => {
    if (!workspace?.businessId) return

    setIsLoading(true)
    setError('')
    try {
      const data = await loadInventoryData(workspace.businessId)
      setInventory(data)
      setSelectedBranch((current) => {
        if (current === '' || data.branches.some((branch) => branch.id === current)) return current
        return data.branches.some((branch) => branch.id === workspace.branchId)
          ? workspace.branchId
          : data.branches[0]?.id ?? ''
      })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถโหลดข้อมูลสต๊อกได้')
    } finally {
      setIsLoading(false)
    }
  }, [workspace?.branchId, workspace?.businessId])

  useEffect(() => {
    if (workspace?.businessId) {
      void refreshData()
    }
  }, [refreshData, workspace?.businessId])

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('th')
    return (inventory?.items ?? []).filter((item) => {
      const matchesBranch = !selectedBranch || item.branch_id === selectedBranch
      const matchesSearch = !normalizedSearch || [item.product_name, item.sku ?? '']
        .some((value) => value.toLocaleLowerCase('th').includes(normalizedSearch))
      const matchesStockStatus = !lowStockOnly || isLowStock(item)
      return matchesBranch && matchesSearch && matchesStockStatus
    })
  }, [inventory?.items, lowStockOnly, search, selectedBranch])

  const visibleMovements = useMemo(() => (
    (inventory?.movements ?? []).filter((movement) => !selectedBranch || movement.branch_id === selectedBranch)
  ), [inventory?.movements, selectedBranch])

  const summary = useMemo(() => {
    const branchItems = (inventory?.items ?? []).filter((item) => !selectedBranch || item.branch_id === selectedBranch)
    return {
      available: branchItems.reduce((total, item) => total + item.available_quantity, 0),
      low: branchItems.filter(isLowStock).length,
      products: branchItems.length,
    }
  }, [inventory?.items, selectedBranch])

  async function handleSaveAdjustment(input: {
    movementType: InventoryMovementType
    notes: string
    quantity: number
    reason: string
  }) {
    if (!workspace?.businessId || !adjustingItem) {
      throw new Error('ไม่พบธุรกิจ สาขา หรือสินค้าที่ต้องการปรับสต๊อก')
    }

    setIsSaving(true)
    setError('')
    setSuccess('')
    const payload: InventoryAdjustmentInput = {
      branchId: adjustingItem.branch_id,
      businessId: workspace.businessId,
      movementType: input.movementType,
      notes: input.notes,
      productId: adjustingItem.product_id,
      quantity: input.quantity,
      reason: input.reason,
    }

    try {
      await adjustInventory(payload)
      const productName = adjustingItem.product_name
      setAdjustingItem(null)
      setSuccess(`ปรับสต๊อก “${productName}” เรียบร้อยแล้ว`)
      await refreshData()
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
    <div className="inventory-page">
      <section className="inventory-heading">
        <div>
          <p className="eyebrow">Inventory</p>
          <h2>สต๊อกสินค้า</h2>
          <p>ตรวจสอบยอดคงเหลือและปรับสต๊อกแยกตามสาขาของ {workspace.businessName}</p>
        </div>
      </section>

      {!canManage && <p className="permission-notice">บัญชี staff สามารถดูยอดและประวัติสต๊อกได้อย่างเดียว</p>}
      {error && <p className="form-error page-message" role="alert">{error}</p>}
      {success && <p className="form-success page-message" role="status">{success}</p>}

      <section className="inventory-summary" aria-label="สรุปสต๊อก">
        <article><span>สินค้าในมุมมอง</span><strong>{isLoading ? '…' : quantityFormatter.format(summary.products)}</strong></article>
        <article><span>พร้อมขายรวม</span><strong>{isLoading ? '…' : quantityFormatter.format(summary.available)}</strong></article>
        <article className={summary.low > 0 ? 'warning' : ''}><span>ใกล้หมด / หมด</span><strong>{isLoading ? '…' : quantityFormatter.format(summary.low)}</strong></article>
      </section>

      <section className="inventory-toolbar" aria-label="ค้นหาและกรองสต๊อก">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาจากชื่อสินค้า หรือ SKU" type="search" value={search} />
        </label>
        <label className="filter-field inventory-branch-filter">
          <span>สาขา</span>
          <select onChange={(event) => setSelectedBranch(event.target.value)} value={selectedBranch ?? ''}>
            <option value="">ทุกสาขาที่เข้าถึงได้</option>
            {(inventory?.branches ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}{branch.is_headquarters ? ' (สำนักงานใหญ่)' : ''}</option>
            ))}
          </select>
        </label>
        <label className="low-stock-filter">
          <input checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} type="checkbox" />
          แสดงเฉพาะสินค้าใกล้หมด
        </label>
      </section>

      <section className="inventory-list-card">
        {isLoading ? (
          <div className="empty-state" aria-live="polite"><strong>กำลังโหลดข้อมูลสต๊อก…</strong><span>กรุณารอสักครู่</span></div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <strong>{(inventory?.items.length ?? 0) === 0 ? 'ยังไม่มีสินค้าที่ติดตามสต๊อก' : 'ไม่พบสต๊อกที่ตรงกับตัวกรอง'}</strong>
            <span>{(inventory?.items.length ?? 0) === 0 ? 'เปิดการติดตามสต๊อกที่หน้าสินค้าก่อนเริ่มกำหนดยอด' : 'ลองเปลี่ยนคำค้นหา สาขา หรือตัวกรองสินค้าใกล้หมด'}</span>
          </div>
        ) : (
          <>
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead><tr><th>สินค้า</th><th>สาขา</th><th>คงเหลือ</th><th>จอง</th><th>พร้อมขาย</th><th>จุดแจ้งเตือน</th><th>สถานะ</th>{canManage && <th>จัดการ</th>}</tr></thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={`${item.branch_id}:${item.product_id}`}>
                      <td><strong>{item.product_name}</strong><small>{item.sku ? `SKU: ${item.sku}` : 'ไม่มี SKU'}{!item.is_product_active ? ' · ปิดใช้งาน' : ''}</small></td>
                      <td>{item.branch_name}<small>{item.branch_code}</small></td>
                      <td>{quantityFormatter.format(item.quantity)} <small>{item.unit_abbreviation || item.unit_name || ''}</small></td>
                      <td>{quantityFormatter.format(item.reserved_quantity)}</td>
                      <td><strong>{quantityFormatter.format(item.available_quantity)}</strong></td>
                      <td>{quantityFormatter.format(item.low_stock_threshold)}</td>
                      <td><InventoryStatus item={item} /></td>
                      {canManage && <td><button className="action-button inventory-adjust-button" disabled={isSaving} onClick={() => setAdjustingItem(item)} type="button">ปรับสต๊อก</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="inventory-mobile-list">
              {filteredItems.map((item) => (
                <article className="inventory-mobile-card" key={`${item.branch_id}:${item.product_id}`}>
                  <div className="inventory-mobile-heading">
                    <div><strong>{item.product_name}</strong><small>{item.sku || 'ไม่มี SKU'} · {item.branch_name}</small></div>
                    <InventoryStatus item={item} />
                  </div>
                  <dl>
                    <div><dt>คงเหลือ</dt><dd>{quantityFormatter.format(item.quantity)}</dd></div>
                    <div><dt>จอง</dt><dd>{quantityFormatter.format(item.reserved_quantity)}</dd></div>
                    <div><dt>พร้อมขาย</dt><dd>{quantityFormatter.format(item.available_quantity)}</dd></div>
                    <div><dt>จุดแจ้งเตือน</dt><dd>{quantityFormatter.format(item.low_stock_threshold)}</dd></div>
                  </dl>
                  {canManage && <button className="secondary-button" disabled={isSaving} onClick={() => setAdjustingItem(item)} type="button">ปรับสต๊อก</button>}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="inventory-history-card">
        <div className="inventory-section-heading">
          <div><p className="eyebrow">Movement History</p><h3>ประวัติการเคลื่อนไหวล่าสุด</h3></div>
          <span>{visibleMovements.length} รายการล่าสุด</span>
        </div>
        {isLoading ? (
          <p className="compact-empty">กำลังโหลดประวัติ…</p>
        ) : visibleMovements.length === 0 ? (
          <p className="compact-empty">ยังไม่มีประวัติการเคลื่อนไหวสต๊อกในสาขาที่เลือก</p>
        ) : (
          <div className="inventory-history-wrap">
            <table className="inventory-history-table">
              <thead><tr><th>วันเวลา</th><th>สินค้า / สาขา</th><th>ประเภท</th><th>เปลี่ยนแปลง</th><th>ก่อน → หลัง</th><th>เหตุผล</th></tr></thead>
              <tbody>
                {visibleMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td data-label="วันเวลา">{dateTimeFormatter.format(new Date(movement.occurred_at))}</td>
                    <td data-label="สินค้า / สาขา"><strong>{movement.product_name}</strong><small>{movement.branch_name}</small></td>
                    <td data-label="ประเภท">{movementLabels[movement.movement_type] ?? movement.movement_type}</td>
                    <td data-label="เปลี่ยนแปลง"><span className={movement.quantity_change >= 0 ? 'quantity-positive' : 'quantity-negative'}>{movement.quantity_change > 0 ? '+' : ''}{quantityFormatter.format(movement.quantity_change)}</span></td>
                    <td data-label="ก่อน → หลัง">{quantityFormatter.format(movement.quantity_before)} → {quantityFormatter.format(movement.quantity_after)}</td>
                    <td data-label="เหตุผล">{movement.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adjustingItem && (
        <InventoryAdjustmentModal
          isSaving={isSaving}
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSave={handleSaveAdjustment}
        />
      )}
    </div>
  )
}
