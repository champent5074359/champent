import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

type AuthState = {
  isLoading: boolean
  session: Session | null
  user: User | null
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: Boolean(supabase),
    session: null,
    user: null,
  })

  useEffect(() => {
    if (!supabase) {
      setState({ isLoading: false, session: null, user: null })
      return
    }

    void supabase.auth.getSession().then(({ data }) => {
      setState({ isLoading: false, session: data.session, user: data.session?.user ?? null })
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ isLoading: false, session, user: session?.user ?? null })
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth ต้องถูกเรียกภายใน AuthProvider')
  }

  return context
}
