import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'

const navigation = [
  { available: true, label: 'แดชบอร์ด', icon: '▦', to: '/dashboard' },
  { available: false, label: 'การขาย', icon: '↗', to: '' },
  { available: true, label: 'สินค้า', icon: '□', to: '/products' },
  { available: true, label: 'สต๊อก', icon: '▤', to: '/inventory' },
  { available: false, label: 'การซื้อ', icon: '▣', to: '' },
  { available: false, label: 'การเงิน', icon: '◫', to: '' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <Logo />
      <nav aria-label="Main navigation">
        <p className="nav-label">พื้นที่ทำงาน</p>
        {navigation.map((item) => item.available ? (
          <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} key={item.label} to={item.to}>
            <span aria-hidden="true" className="nav-icon">{item.icon}</span>{item.label}
          </NavLink>
        ) : (
          <span aria-disabled="true" className="nav-link disabled" key={item.label}>
            <span aria-hidden="true" className="nav-icon">{item.icon}</span>{item.label}<small>เร็ว ๆ นี้</small>
          </span>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span aria-disabled="true" className="nav-link disabled">
          <span aria-hidden="true" className="nav-icon">⚙</span>
          ตั้งค่า
        </span>
        <p>BusinessOS v0.1.0</p>
      </div>
    </aside>
  )
}
