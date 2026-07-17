import { supabase } from './supabase'

export type BusinessType =
  | 'food'
  | 'fashion'
  | 'retail'
  | 'service'
  | 'manufacturing'
  | 'warehouse'
  | 'other'

export type DashboardContext = {
  branchName: string
  businessId: string
  businessName: string
  memberRole: 'owner' | 'manager' | 'staff'
  userName: string
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase')
  }

  return supabase
}

export async function hasActiveBusinessMembership(profileId: string) {
  const client = requireSupabase()

  const { data, error } = await client
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
  const client = requireSupabase()

  const { error } = await client.rpc('create_business_with_owner', {
    p_branch_name: branchName.trim(),
    p_business_name: businessName.trim(),
    p_business_type: businessType,
  })

  if (error) {
    throw new Error('ไม่สามารถสร้างพื้นที่ธุรกิจได้ กรุณาลองใหม่อีกครั้ง')
  }
}

export async function getDashboardContext(profileId: string): Promise<DashboardContext> {
  const client = requireSupabase()

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('full_name')
    .eq('id', profileId)
    .eq('is_deleted', false)
    .single()

  if (profileError) {
    throw new Error('ไม่สามารถโหลดข้อมูลผู้ใช้งานได้')
  }

  const { data: membership, error: membershipError } = await client
    .from('business_members')
    .select('id, business_id, role')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .eq('is_deleted', false)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  if (membershipError) {
    throw new Error('ไม่พบธุรกิจที่ผู้ใช้งานมีสิทธิ์เข้าถึง')
  }

  const { data: business, error: businessError } = await client
    .from('businesses')
    .select('name')
    .eq('id', membership.business_id)
    .eq('is_deleted', false)
    .single()

  if (businessError) {
    throw new Error('ไม่สามารถโหลดข้อมูลธุรกิจได้')
  }

  const { data: branchMembership, error: branchMembershipError } = await client
    .from('branch_members')
    .select('branch_id, is_default')
    .eq('business_member_id', membership.id)
    .eq('is_deleted', false)
    .order('is_default', { ascending: false })
    .limit(1)
    .single()

  if (branchMembershipError) {
    throw new Error('ไม่พบสาขาที่ผู้ใช้งานมีสิทธิ์เข้าถึง')
  }

  const { data: branch, error: branchError } = await client
    .from('branches')
    .select('name')
    .eq('id', branchMembership.branch_id)
    .eq('is_deleted', false)
    .single()

  if (branchError) {
    throw new Error('ไม่สามารถโหลดข้อมูลสาขาได้')
  }

  return {
    branchName: branch.name,
    businessId: membership.business_id,
    businessName: business.name,
    memberRole: membership.role,
    userName: profile.full_name,
  }
}
