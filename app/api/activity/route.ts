import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError, databaseError } from '@/lib/api'
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(request.url)
    const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1))
    const type = url.searchParams.get('type')
    let query = supabase.from('system_events').select('*', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).order('id', { ascending: false })
    if (type && type !== 'all') query = query.eq('type', type)
    const { data, error, count } = await query.range((Math.floor(page) - 1) * 30, Math.floor(page) * 30 - 1)
    if (error) return databaseError(error)
    return NextResponse.json({ activities: data, total: count || 0 })
  } catch (error) { return apiError(error) }
}
