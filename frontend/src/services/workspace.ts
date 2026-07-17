import { supabase } from './supabase'

export type BusinessType =
  | 'food'
  | 'fashion'
  | 'retail'
  | 'service'
  | 'manufacturing'
  | 'warehouse'
  | 'other'

export async function hasActiveBusinessMembership(profileId: string) {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase')
  }

  const { data, error } = await supabase
    .from('business_members')
    .select('id')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .eq('is_deleted', false)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error('ไม่สามารถตรวจสอบข้อมูลธุรกิจได้')
  }

  return Boolean(data)
}

export async function createBusinessWorkspace(
  businessName: string,
  businessType: BusinessType,
  branchName: string,
) {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase')
  }

  const { error } = await supabase.rpc('create_business_with_owner', {
    p_branch_name: branchName.trim(),
    p_business_name: businessName.trim(),
    p_business_type: businessType,
  })

  if (error) {
    throw new Error('ไม่สามารถสร้างพื้นที่ธุรกิจได้ กรุณาลองใหม่อีกครั้ง')
  }
}
