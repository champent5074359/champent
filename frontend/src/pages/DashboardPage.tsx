import { StatCard } from '../components/StatCard'

const nextSteps = [
  ['สินค้า', 'เริ่มสร้างสินค้าและหมวดหมู่ของคุณ'],
  ['สต็อก', 'กำหนดสต็อกเริ่มต้นสำหรับแต่ละสาขา'],
  ['การขาย', 'บันทึกรายการขายครั้งแรก'],
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
        <StatCard change="พร้อมเชื่อมข้อมูล" label="ยอดขายวันนี้" trend="neutral" value="—" />
        <StatCard change="พร้อมเชื่อมข้อมูล" label="คำสั่งซื้อ" trend="neutral" value="—" />
        <StatCard change="ติดตามใน Sprint ถัดไป" label="สต็อกต่ำ" trend="warning" value="0 รายการ" />
        <StatCard change="ข้อมูลจริงจะเชื่อมใน Sprint ถัดไป" label="สาขาที่ใช้งาน" trend="positive" value="—" />
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
          <h3>ตั้งค่าธุรกิจเรียบร้อยแล้ว</h3>
          <p className="branch-copy">ข้อมูลสาขาจริงจะถูกแสดงในหน้าจอนี้ใน Sprint ถัดไป</p>
          <div className="branch-status"><span /> บัญชีของคุณเข้าสู่ระบบแล้ว</div>
        </article>
      </section>
    </div>
  )
}
