import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, databaseError, parseBody } from '@/lib/api'
import { timezone } from '@/lib/validation'
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
const settingsSchema = z.object({ theme: z.enum(['dark','light','system']), timezone: timezone.optional(), day_start_time: clock, day_end_time: clock, notifications_enabled: z.boolean(), allow_auto_shift: z.boolean(), allow_fixed_quests_shift: z.boolean(), sounds_enabled: z.boolean().optional(), effects_enabled: z.boolean().optional() }).refine(v => v.day_end_time > v.day_start_time, 'End of day must follow start of day')
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const maintenance = await supabase.rpc('maintain_discipline_user')
    if (maintenance.error) return databaseError(maintenance.error)
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
    if (error) return databaseError(error)
    return NextResponse.json(data)
  } catch (error) { return apiError(error) }
}
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const input = await parseBody(request, settingsSchema)
    const { data, error } = await supabase.from('user_settings').update({ ...input, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().single()
    if (error) return databaseError(error)
    return NextResponse.json(data)
  } catch (error) { return apiError(error) }
}
