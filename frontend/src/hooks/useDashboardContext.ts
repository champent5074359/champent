import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { getDashboardContext } from '../services/workspace'
import type { DashboardContext } from '../services/workspace'

type DashboardContextState = {
  data: DashboardContext | null
  error: string | null
  isLoading: boolean
}

export function useDashboardContext(): DashboardContextState {
  const { user } = useAuth()
  const [state, setState] = useState<DashboardContextState>({
    data: null,
    error: null,
    isLoading: Boolean(user),
  })

  useEffect(() => {
    if (!user) {
      setState({ data: null, error: null, isLoading: false })
      return
    }

    let isCurrent = true
    setState({ data: null, error: null, isLoading: true })

    void getDashboardContext(user.id)
      .then((data) => {
        if (isCurrent) {
          setState({ data, error: null, isLoading: false })
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลแดชบอร์ดได้',
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
