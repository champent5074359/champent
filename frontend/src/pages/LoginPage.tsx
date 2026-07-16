import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { signInWithPassword } from '../services/auth'
import { isSupabaseConfigured } from '../services/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!isSupabaseConfigured) {
      setError('Supabase ยังไม่ได้ตั้งค่า กรุณาเพิ่มค่าในไฟล์ .env.local ก่อนเข้าสู่ระบบ')
      return
    }

    setIsSubmitting(true)
    try {
      await signInWithPassword(email, password)
      navigate('/dashboard')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-heading">
        <Logo />
        <div className="login-copy">
          <p className="eyebrow">Welcome back</p>
          <h1 id="login-heading">จัดการธุรกิจของคุณ<br />ในที่เดียว</h1>
          <p>เข้าสู่ระบบเพื่อดูภาพรวมยอดขาย สต็อก และการดำเนินงานของทุกสาขา</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'Login'}
          </button>
        </form>
        <p className="login-footer">BusinessOS · ระบบหลังบ้านสำหรับธุรกิจของคุณ</p>
      </section>
      <aside className="login-aside" aria-hidden="true">
        <div className="login-orb orb-one" />
        <div className="login-orb orb-two" />
        <div className="insight-card insight-card-main">
          <span>ยอดขายวันนี้</span>
          <strong>฿24,580</strong>
          <small>↗ 12.5% จากเมื่อวาน</small>
        </div>
        <div className="insight-card insight-card-mini">
          <span>สินค้าคงเหลือ</span>
          <strong>1,248</strong>
        </div>
      </aside>
    </main>
  )
}
