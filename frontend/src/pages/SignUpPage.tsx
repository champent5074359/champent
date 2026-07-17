import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { signUp } from '../services/auth'
import { isSupabaseConfigured } from '../services/supabase'

export function SignUpPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!isSupabaseConfigured) {
      setError('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase')
      return
    }

    if (password !== confirmPassword) {
      setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    setIsSubmitting(true)
    try {
      const { session } = await signUp(fullName.trim(), email, password)

      if (session) {
        navigate('/setup')
        return
      }

      setSuccess('สร้างบัญชีแล้ว กรุณายืนยันอีเมลจากกล่องข้อความก่อน แล้วจึงกลับมาเข้าสู่ระบบ')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="signup-heading">
        <Logo />
        <div className="login-copy signup-copy">
          <p className="eyebrow">เริ่มต้นใช้งาน</p>
          <h1 id="signup-heading">สร้างบัญชี<br />BusinessOS</h1>
          <p>เริ่มจัดการธุรกิจและสาขาของคุณได้ในไม่กี่ขั้นตอน</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            ชื่อผู้ใช้งาน
            <input autoComplete="name" onChange={(event) => setFullName(event.target.value)} placeholder="ชื่อ-นามสกุล" required value={fullName} />
          </label>
          <label>
            อีเมล
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
          </label>
          <label>
            รหัสผ่าน
            <input autoComplete="new-password" minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" required type="password" value={password} />
          </label>
          <label>
            ยืนยันรหัสผ่าน
            <input autoComplete="new-password" minLength={6} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="กรอกรหัสผ่านอีกครั้ง" required type="password" value={confirmPassword} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {success && <p className="form-success" role="status">{success}</p>}
          <button className="primary-button" disabled={isSubmitting || Boolean(success)} type="submit">
            {isSubmitting ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี'}
          </button>
        </form>
        <p className="auth-switch">มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบ</Link></p>
      </section>
      <aside className="login-aside signup-aside" aria-hidden="true">
        <div className="login-orb orb-one" />
        <div className="login-orb orb-two" />
        <div className="insight-card insight-card-main">
          <span>พร้อมขยายธุรกิจ</span>
          <strong>หลายสาขา</strong>
          <small>บริหารข้อมูลในพื้นที่เดียว</small>
        </div>
      </aside>
    </main>
  )
}
