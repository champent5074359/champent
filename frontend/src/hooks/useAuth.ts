import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

type AuthState = {
  isLoading: boolean
  user: User | null
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ isLoading: Boolean(supabase), user: null })

  useEffect(() => {
    if (!supabase) {
      setState({ isLoading: false, user: null })
      return
    }

    void supabase.auth.getUser().then(({ data }) => {
      setState({ isLoading: false, user: data.user })
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ isLoading: false, user: session?.user ?? null })
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return state
}
