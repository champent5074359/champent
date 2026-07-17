import { supabase } from './supabase'

function translateAuthError(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
  }

  if (normalizedMessage.includes('user already registered')) {
    return 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบแทน'
  }

  if (normalizedMessage.includes('password should be at least')) {
    return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
  }

  if (normalizedMessage.includes('rate limit')) {
    return 'มีการทำรายการบ่อยเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง'
  }

  return 'ไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง'
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase')
  }

  return supabase
}

export async function signInWithPassword(email: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(translateAuthError(error.message))
  }

  return data
}

export async function signUp(fullName: string, email: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    throw new Error(translateAuthError(error.message))
  }

  return data
}

export async function signOut() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()

  if (error) {
    throw new Error(translateAuthError(error.message))
  }
}
