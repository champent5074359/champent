import { supabase } from './supabase'

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) {
    throw new Error('Supabase ยังไม่ได้ตั้งค่า')
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    throw error
  }

  return data
}

export async function signOut() {
  if (!supabase) {
    return
  }

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}
