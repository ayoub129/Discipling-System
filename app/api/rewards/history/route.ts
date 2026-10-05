import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError, databaseError } from '@/lib/api'
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const redemptions = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('reward_redemptions').select('id,reward_id,reward_name,point_cost,redeemed_at').eq('user_id', user.id).order('redeemed_at', { ascending: false }).order('id').range(offset, offset + 499)
      if (error) return databaseError(error)
      redemptions.push(...(data || []))
      if (!data || data.length < 500) break
    }
    return NextResponse.json({ redemptions })
  } catch (error) { return apiError(error) }
}
