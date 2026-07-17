import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { signOut } from '../services/auth'
import { createBusinessWorkspace } from '../services/workspace'

const businessTypes = [
  { value: 'food', label: 'ร้านอาหาร' },
  { value: 'fashion', label: 'ร้านเสื้อผ้า' },
  { value: 'retail', label: 'ร้านค้าปลีก' },
  { value: 'service', label: 'ธุรกิจบริการ' },
  { value: 'manufacturing', label: 'ธุรกิจการผลิต' },
  { value: 'warehouse', label: 'คลังสินค้า' },
  { value: 'other', label: 'อื่น ๆ' },
] as const

export function OnboardingPage() {
  const navigate = useNavigate()
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState<(typeof businessTypes)[number]['value']>('retail')
  const [branchName, setBranchName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await createBusinessWorkspace(businessName, businessType, branchName)
      navigate('/dashboard')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถเริ่มใช้งานได้ กรุณาลองใหม่')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <main className="setup-page">
      <section className="setup-panel" aria-labelledby="setup-heading">
        <div className="setup-topbar">
          <Logo />
          <button className="text-button" onClick={() => void handleSignOut()} type="button">ออกจากระบบ</button>
        </div>
        <div className="setup-copy">
          <p className="eyebrow">ตั้งค่าครั้งแรก</p>
          <h1 id="setup-heading">สร้างพื้นที่ธุรกิจของคุณ</h1>
          <p>ข้อมูลนี้จะเป็นพื้นที่แรกสำหรับจัดการร้านและสาขาของคุณ</p>
        </div>
        <form className="setup-form" onSubmit={handleSubmit}>
          <label>
            ชื่อธุรกิจ
            <input onChange={(event) => setBusinessName(event.target.value)} placeholder="เช่น ร้านสุขใจ" required value={businessName} />
          </label>
          <fieldset>
            <legend>ประเภทธุรกิจ</legend>
            <div className="business-type-grid">
              {businessTypes.map((type) => (
                <label className={`business-type-option ${businessType === type.value ? 'selected' : ''}`} key={type.value}>
                  <input checked={businessType === type.value} name="businessType" onChange={() => setBusinessType(type.value)} type="radio" value={type.value} />
                  {type.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            ชื่อสาขาแรก
            <input onChange={(event) => setBranchName(event.target.value)} placeholder="เช่น สาขาหลัก" required value={branchName} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'กำลังสร้างพื้นที่ธุรกิจ…' : 'เริ่มใช้งาน'}
          </button>
        </form>
      </section>
    </main>
  )
}
