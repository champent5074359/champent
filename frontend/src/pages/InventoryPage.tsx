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
  adjustment_in: 'ปรับเพิ่มสต๊อก',
  adjustment_out: 'ปรับลดสต๊อก',
  opening_balance: 'กำหนดยอดตั้งต้น',
  stock_count: 'ตรวจนับยอดจริง',
}

type InventorySort = 'available' | 'name' | 'quantity' | 'status'
type StockStatus = 'healthy' | 'low' | 'out'
type StockStatusFilter = 'all' | StockStatus

const pageSizes = [20, 50, 100] as const
const statusPriority: Record<StockStatus, number> = {
  out: 0,
  low: 1,
  healthy: 2,
}

function isLowStock(item: InventoryItem) {
  return item.available_quantity <= item.low_stock_threshold
}

function getStockStatus(item: InventoryItem): { className: StockStatus; label: string } {
  if (item.available_quantity <= 0) {
    return { className: 'out', label: 'หมด' }
  }
  if (isLowStock(item)) {
    return { className: 'low', label: 'ใกล้หมด' }
  }
  return { className: 'healthy', label: 'ปกติ' }
}

function getQuantityChangeClass(quantityChange: number) {
  if (quantityChange > 0) return 'quantity-positive'
  if (quantityChange < 0) return 'quantity-negative'
  return 'quantity-neutral'
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
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('all')
  const [sortBy, setSortBy] = useState<InventorySort>('name')
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(20)
  const [currentPage, setCurrentPage] = useState(1)
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
    const matchingItems = (inventory?.items ?? []).filter((item) => {
      const matchesBranch = !selectedBranch || item.branch_id === selectedBranch
      const matchesSearch = !normalizedSearch || [item.product_name, item.sku ?? '']
        .some((value) => value.toLocaleLowerCase('th').includes(normalizedSearch))
      const matchesCategory = !categoryFilter || item.category_id === categoryFilter
      const matchesStatus = statusFilter === 'all' || getStockStatus(item).className === statusFilter
      return matchesBranch && matchesSearch && matchesCategory && matchesStatus
    })

    return [...matchingItems].sort((left, right) => {
      if (sortBy === 'quantity') {
        return left.quantity - right.quantity || left.product_name.localeCompare(right.product_name, 'th')
      }
      if (sortBy === 'available') {
        return left.available_quantity - right.available_quantity || left.product_name.localeCompare(right.product_name, 'th')
      }
      if (sortBy === 'status') {
        return statusPriority[getStockStatus(left).className] - statusPriority[getStockStatus(right).className]
          || left.available_quantity - right.available_quantity
          || left.product_name.localeCompare(right.product_name, 'th')
      }
      return left.product_name.localeCompare(right.product_name, 'th', { sensitivity: 'base' })
        || left.branch_name.localeCompare(right.branch_name, 'th', { sensitivity: 'base' })
    })
  }, [categoryFilter, inventory?.items, search, selectedBranch, sortBy, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const visiblePage = Math.min(currentPage, totalPages)
  const pageStart = (visiblePage - 1) * pageSize
  const paginatedItems = filteredItems.slice(pageStart, pageStart + pageSize)

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

  const selectedBranchItems = useMemo(() => (
    (inventory?.items ?? []).filter((item) => !selectedBranch || item.branch_id === selectedBranch)
  ), [inventory?.items, selectedBranch])
  const hasUninitializedInventory = selectedBranchItems.length > 0
    && selectedBranchItems.every((item) => !item.last_movement_at)

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
          <input onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }} placeholder="ค้นหาจากชื่อสินค้า หรือ SKU" type="search" value={search} />
        </label>
        <label className="filter-field inventory-branch-filter">
          <span>สาขา</span>
          <select onChange={(event) => { setSelectedBranch(event.target.value); setCurrentPage(1) }} value={selectedBranch ?? ''}>
            <option value="">ทุกสาขาที่เข้าถึงได้</option>
            {(inventory?.branches ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}{branch.is_headquarters ? ' (สำนักงานใหญ่)' : ''}</option>
            ))}
          </select>
        </label>
        <label className="filter-field inventory-filter-field">
          <span>หมวดหมู่</span>
          <select onChange={(event) => { setCategoryFilter(event.target.value); setCurrentPage(1) }} value={categoryFilter}>
            <option value="">ทั้งหมด</option>
            {(inventory?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="filter-field inventory-filter-field">
          <span>สถานะ</span>
          <select onChange={(event) => { setStatusFilter(event.target.value as StockStatusFilter); setCurrentPage(1) }} value={statusFilter}>
            <option value="all">ทั้งหมด</option>
            <option value="healthy">ปกติ</option>
            <option value="low">ใกล้หมด</option>
            <option value="out">หมดสต๊อก</option>
          </select>
        </label>
        <label className="filter-field inventory-filter-field">
          <span>เรียงตาม</span>
          <select onChange={(event) => { setSortBy(event.target.value as InventorySort); setCurrentPage(1) }} value={sortBy}>
            <option value="name">ชื่อสินค้า ก–ฮ</option>
            <option value="quantity">คงเหลือน้อย → มาก</option>
            <option value="available">พร้อมขายน้อย → มาก</option>
            <option value="status">สถานะเร่งด่วนก่อน</option>
          </select>
        </label>
      </section>

      {!isLoading && hasUninitializedInventory && (
        <p className="inventory-onboarding-note" role="status">
          <strong>ยังไม่เคยกำหนดยอดสต๊อกในมุมมองนี้</strong>
          <span>{canManage ? 'เริ่มต้นด้วย “ยอดตั้งต้น” หรือใช้ “ตรวจนับยอดจริง” จากปุ่มปรับสต๊อก' : 'ผู้ดูแลสามารถเริ่มต้นด้วยยอดตั้งต้นหรือยอดตรวจนับจริง'}</span>
        </p>
      )}

      <section className="inventory-list-card">
        {isLoading ? (
          <div className="empty-state" aria-live="polite"><strong>กำลังโหลดข้อมูลสต๊อก…</strong><span>กรุณารอสักครู่</span></div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <strong>{(inventory?.items.length ?? 0) === 0 ? 'ยังไม่มีสินค้าที่ติดตามสต๊อก' : 'ไม่พบสต๊อกที่ตรงกับตัวกรอง'}</strong>
            <span>{(inventory?.items.length ?? 0) === 0 ? 'เปิดการติดตามสต๊อกที่หน้าสินค้า จากนั้นเริ่มด้วยยอดตั้งต้นหรือยอดตรวจนับจริง' : 'ลองเปลี่ยนคำค้นหา สาขา หมวดหมู่ หรือสถานะสต๊อก'}</span>
          </div>
        ) : (
          <>
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead><tr><th>สินค้า</th><th>สาขา</th><th>คงเหลือ</th><th>จอง</th><th>พร้อมขาย</th><th>จุดแจ้งเตือน</th><th>สถานะ</th>{canManage && <th>จัดการ</th>}</tr></thead>
                <tbody>
                  {paginatedItems.map((item) => (
                    <tr key={`${item.branch_id}:${item.product_id}`}>
                      <td><strong>{item.product_name}</strong><small>{item.sku ? `SKU: ${item.sku}` : 'ไม่มี SKU'} · {item.category_name || 'ไม่ระบุหมวดหมู่'}{!item.is_product_active ? ' · ปิดใช้งาน' : ''}</small></td>
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
              {paginatedItems.map((item) => (
                <article className="inventory-mobile-card" key={`${item.branch_id}:${item.product_id}`}>
                  <div className="inventory-mobile-heading">
                    <div><strong>{item.product_name}</strong><small>{item.sku || 'ไม่มี SKU'} · {item.category_name || 'ไม่ระบุหมวดหมู่'} · {item.branch_name}</small></div>
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

            <div className="inventory-pagination">
              <span>แสดง {pageStart + 1}–{Math.min(pageStart + pageSize, filteredItems.length)} จาก {filteredItems.length} รายการ</span>
              <div className="inventory-page-size">
                <label>
                  แสดงต่อหน้า
                  <select onChange={(event) => { setPageSize(Number(event.target.value) as (typeof pageSizes)[number]); setCurrentPage(1) }} value={pageSize}>
                    {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
              </div>
              <div className="pagination-actions">
                <button className="secondary-button" disabled={visiblePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} type="button">ก่อนหน้า</button>
                <span>หน้า {visiblePage} / {totalPages}</span>
                <button className="secondary-button" disabled={visiblePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} type="button">ถัดไป</button>
              </div>
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
                    <td data-label="ประเภท"><span className={`movement-pill movement-${movement.movement_type}`}>{movementLabels[movement.movement_type] ?? movement.movement_type}</span></td>
                    <td data-label="เปลี่ยนแปลง"><span className={`quantity-change ${getQuantityChangeClass(movement.quantity_change)}`}>{movement.quantity_change > 0 ? '+' : ''}{quantityFormatter.format(movement.quantity_change)}</span></td>
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
