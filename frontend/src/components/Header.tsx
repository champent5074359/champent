import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/auth'

export function Header() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fullName = typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : 'ผู้ใช้งาน'
  const initials = fullName.slice(0, 2).toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="header">
      <div>
        <p className="eyebrow">ภาพรวม</p>
        <h1>แดชบอร์ด</h1>
      </div>
      <div className="header-actions">
        <button className="branch-switcher" type="button" aria-label="Change active branch">
          <span className="branch-icon" aria-hidden="true">⌂</span>
          <span><strong>พื้นที่ธุรกิจ</strong><small>เลือกสาขาใน Sprint ถัดไป</small></span>
          <span aria-hidden="true">⌄</span>
        </button>
        <span className="user-name">{fullName}</span>
        <button className="avatar" type="button" aria-label="ข้อมูลผู้ใช้งาน">{initials}</button>
        <button className="signout-button" onClick={() => void handleSignOut()} type="button">ออกจากระบบ</button>
      </div>
    </header>
  )
}
