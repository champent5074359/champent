import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDashboardContext } from '../hooks/useDashboardContext'
import { signOut } from '../services/auth'

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { data, error: contextError, isLoading } = useDashboardContext()
  const [signOutError, setSignOutError] = useState('')
  const metadataName = typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : ''
  const fullName = data?.userName || metadataName || user?.email || 'ผู้ใช้งาน'
  const initials = fullName.slice(0, 2).toUpperCase()
  const isProductsPage = location.pathname === '/products'
  const isInventoryPage = location.pathname === '/inventory'
  const pageEyebrow = isProductsPage ? 'ข้อมูลหลัก' : isInventoryPage ? 'คลังสินค้า' : 'ภาพรวม'
  const pageTitle = isProductsPage ? 'สินค้า' : isInventoryPage ? 'สต๊อกสินค้า' : 'แดชบอร์ด'

  async function handleSignOut() {
    setSignOutError('')

    try {
      await signOut()
      navigate('/login')
    } catch (caughtError) {
      setSignOutError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถออกจากระบบได้ กรุณาลองใหม่')
    }
  }

  return (
    <header className="header">
      <div>
        <p className="eyebrow">{pageEyebrow}</p>
        <h1>{pageTitle}</h1>
      </div>
      <div className="header-actions">
        <button className="branch-switcher" type="button" aria-label="Change active branch">
          <span className="branch-icon" aria-hidden="true">⌂</span>
          <span>
            <strong>{isLoading ? 'กำลังโหลดข้อมูล…' : data?.businessName || 'ไม่พบข้อมูลธุรกิจ'}</strong>
            <small>{isLoading ? 'กรุณารอสักครู่' : data?.branchName || 'ไม่พบข้อมูลสาขา'}</small>
          </span>
          <span aria-hidden="true">⌄</span>
        </button>
        <span className="user-name">{fullName}</span>
        <button className="avatar" type="button" aria-label="ข้อมูลผู้ใช้งาน">{initials}</button>
        <button className="signout-button" onClick={() => void handleSignOut()} type="button">ออกจากระบบ</button>
        {(contextError || signOutError) && <span className="header-error" role="alert">{signOutError || contextError}</span>}
      </div>
    </header>
  )
}
