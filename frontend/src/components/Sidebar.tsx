import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'

const navigation = [
  { label: 'Dashboard', icon: '▦', to: '/dashboard' },
  { label: 'Sales', icon: '↗', to: '/dashboard' },
  { label: 'Products', icon: '□', to: '/dashboard' },
  { label: 'Inventory', icon: '▤', to: '/dashboard' },
  { label: 'Purchases', icon: '▣', to: '/dashboard' },
  { label: 'Finance', icon: '◫', to: '/dashboard' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <Logo />
      <nav aria-label="Main navigation">
        <p className="nav-label">Workspace</p>
        {navigation.map((item) => (
          <NavLink
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            key={item.label}
            to={item.to}
          >
            <span aria-hidden="true" className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <NavLink className="nav-link" to="/dashboard">
          <span aria-hidden="true" className="nav-icon">⚙</span>
          Settings
        </NavLink>
        <p>BusinessOS v0.1.0</p>
      </div>
    </aside>
  )
}
