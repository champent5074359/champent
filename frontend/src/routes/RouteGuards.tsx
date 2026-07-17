import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useWorkspaceSetup } from '../hooks/useWorkspaceSetup'

function LoadingScreen() {
  return <main className="route-loading" aria-live="polite">กำลังตรวจสอบสิทธิ์การใช้งาน…</main>
}

export function ProtectedRoute() {
  const { isLoading, user } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}

export function PublicOnlyRoute() {
  const { isLoading, user } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  return user ? <Navigate to="/workspace" replace /> : <Outlet />
}

export function WorkspaceGate() {
  const { error, hasWorkspace, isLoading } = useWorkspaceSetup()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (error) {
    return <main className="route-error" role="alert">{error}</main>
  }

  return <Navigate to={hasWorkspace ? '/dashboard' : '/onboarding'} replace />
}

export function RedirectIfWorkspaceExists({ children }: { children: ReactNode }) {
  const { error, hasWorkspace, isLoading } = useWorkspaceSetup()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (error) {
    return <main className="route-error" role="alert">{error}</main>
  }

  return hasWorkspace ? <Navigate to="/dashboard" replace /> : children
}
