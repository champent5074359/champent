import { Link } from 'react-router-dom'

type LogoProps = {
  compact?: boolean
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <Link className="logo" to="/dashboard" aria-label="BusinessOS dashboard">
      <span className="logo-mark" aria-hidden="true">B</span>
      {!compact && <span>Business<span>OS</span></span>}
    </Link>
  )
}
