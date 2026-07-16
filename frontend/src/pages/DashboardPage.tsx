import { StatCard } from '../components/StatCard'

const nextSteps = [
  ['Products', 'เริ่มสร้างสินค้าและหมวดหมู่ของคุณ'],
  ['Inventory', 'กำหนดสต็อกเริ่มต้นสำหรับแต่ละสาขา'],
  ['Sales', 'บันทึกรายการขายครั้งแรก'],
]

export function DashboardPage() {
  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <h2>สวัสดี! ยินดีต้อนรับสู่ BusinessOS</h2>
          <p>นี่คือศูนย์กลางการดำเนินงานของธุรกิจคุณ</p>
        </div>
        <button className="secondary-button" type="button">+ เพิ่มรายการ</button>
      </section>

      <section className="stat-grid" aria-label="Business overview">
        <StatCard change="พร้อมตั้งค่า" label="ยอดขายวันนี้" trend="neutral" value="฿0.00" />
        <StatCard change="ยังไม่มีรายการ" label="คำสั่งซื้อ" trend="neutral" value="0" />
        <StatCard change="ติดตามใน Sprint ถัดไป" label="สต็อกต่ำ" trend="warning" value="0 รายการ" />
        <StatCard change="พร้อมใช้งาน" label="สาขาที่ใช้งาน" trend="positive" value="1" />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card setup-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Getting started</p>
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
          <p className="eyebrow">Active workspace</p>
          <h3>BusinessOS Demo</h3>
          <p className="branch-copy">Main Branch · กรุงเทพฯ</p>
          <div className="branch-status"><span /> ระบบพร้อมสำหรับการตั้งค่า</div>
        </article>
      </section>
    </div>
  )
}
