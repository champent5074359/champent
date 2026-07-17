import { Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { OnboardingPage } from '../pages/OnboardingPage'
import { SignUpPage } from '../pages/SignUpPage'
import { ProtectedRoute, PublicOnlyRoute, RedirectIfWorkspaceExists, WorkspaceGate } from './RouteGuards'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/workspace" element={<WorkspaceGate />} />
        <Route
          path="/setup"
          element={(
            <RedirectIfWorkspaceExists>
              <OnboardingPage />
            </RedirectIfWorkspaceExists>
          )}
        />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
