import { StatCard } from '../components/StatCard'
import { useDashboardContext } from '../hooks/useDashboardContext'
import { useProductCount } from '../hooks/useProductCount'

const nextSteps = [
  ['สินค้า', 'เริ่มสร้างสินค้าและหมวดหมู่ของคุณ'],
  ['สต็อก', 'กำหนดสต็อกเริ่มต้นสำหรับแต่ละสาขา'],
  ['การขาย', 'บันทึกรายการขายครั้งแรก'],
]

export function DashboardPage() {
  const { data: workspace } = useDashboardContext()
  const { count: productCount, error: productCountError, isLoading: isProductCountLoading } = useProductCount(workspace?.businessId)

  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <h2>สวัสดี{workspace?.userName ? ` ${workspace.userName}` : ''}! ยินดีต้อนรับสู่ BusinessOS</h2>
          <p>นี่คือศูนย์กลางการดำเนินงานของธุรกิจคุณ</p>
        </div>
        <button className="secondary-button" type="button">+ เพิ่มรายการ</button>
      </section>

      <section className="stat-grid" aria-label="Business overview">
        <StatCard change={productCountError || 'จำนวนสินค้าของธุรกิจปัจจุบัน'} label="สินค้า" trend={productCountError ? 'warning' : 'positive'} value={isProductCountLoading ? '…' : productCount === null ? '—' : `${productCount} รายการ`} />
        <StatCard change="ยังไม่เปิดใช้งานใน Sprint นี้" label="ยอดขายวันนี้" trend="neutral" value="—" />
        <StatCard change="ยังไม่เปิดใช้งานใน Sprint นี้" label="การซื้อ" trend="neutral" value="—" />
        <StatCard change="ยังไม่เปิดใช้งานใน Sprint นี้" label="สต๊อกคงเหลือ" trend="neutral" value="—" />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card setup-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">เริ่มต้นใช้งาน</p>
              <h3>เตรียม BusinessOS ของคุณ</h3>
            </div>
            <span className="progress-pill">0 / 3 เสร็จสิ้น</span>
          </div>
          <ol className="setup-list">
            {nextSteps.map(([title, description], index) => (
              <li key={title}>
                <span className="step-number">{index + 1}</span>
                <span><strong>{title}</strong><small>{description}</small></span>
                <button type="button" aria-label={`Open ${title}`}>→</button>
              </li>
            ))}
          </ol>
        </article>
        <article className="dashboard-card branch-card">
          <p className="eyebrow">พื้นที่ธุรกิจ</p>
          <h3>{workspace?.businessName || 'กำลังโหลดข้อมูลธุรกิจ…'}</h3>
          <p className="branch-copy">{workspace?.branchName || 'กำลังโหลดข้อมูลสาขา…'}</p>
          <div className="branch-status"><span /> บัญชีของคุณเข้าสู่ระบบแล้ว</div>
        </article>
      </section>
    </div>
  )
}
