import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { hasActiveBusinessMembership } from '../services/workspace'

type WorkspaceSetupState = {
  error: string | null
  hasWorkspace: boolean
  isLoading: boolean
}

export function useWorkspaceSetup(): WorkspaceSetupState {
  const { user } = useAuth()
  const [state, setState] = useState<WorkspaceSetupState>({
    error: null,
    hasWorkspace: false,
    isLoading: Boolean(user),
  })

  useEffect(() => {
    if (!user) {
      setState({ error: null, hasWorkspace: false, isLoading: false })
      return
    }

    let isCurrent = true
    setState({ error: null, hasWorkspace: false, isLoading: true })

    void hasActiveBusinessMembership(user.id)
      .then((hasWorkspace) => {
        if (isCurrent) {
          setState({ error: null, hasWorkspace, isLoading: false })
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setState({
            error: error instanceof Error ? error.message : 'ไม่สามารถตรวจสอบข้อมูลธุรกิจได้',
            hasWorkspace: false,
            isLoading: false,
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [user])

  return state
}
