import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, databaseError, parseBody } from '@/lib/api'
import { id, penaltyFields } from '@/lib/validation'
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const maintenance = await supabase.rpc('maintain_discipline_user')
    if (maintenance.error) return databaseError(maintenance.error)
    const [defs, instances] = await Promise.all([
      supabase.from('penalty_definitions').select('*').eq('user_id', user.id).is('archived_at', null).order('severity_order'),
      supabase.from('user_penalties').select('*,penalty_definitions(*)').eq('user_id', user.id).order('issued_at', { ascending: false }),
    ])
    if (defs.error) return databaseError(defs.error)
    if (instances.error) return databaseError(instances.error)
    const userPenalties = (instances.data || []).map(p => ({ ...p, penalty_definitions: Array.isArray(p.penalty_definitions) ? p.penalty_definitions[0] : p.penalty_definitions }))
    return NextResponse.json({ definitions: defs.data || [], userPenalties, stats: {
      totalDefinitions: defs.data?.length || 0, totalXpLost: userPenalties.reduce((sum, p) => sum + p.xp_lost, 0),
      activeCount: userPenalties.filter(p => ['created', 'in-progress'].includes(p.status)).length, now: new Date().toISOString(),
    } })
  } catch (error) { return apiError(error) }
}
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const input = await parseBody(request, penaltyFields)
    const { data, error } = await supabase.rpc('create_discipline_penalty', { p_values: input })
    if (error) return databaseError(error)
    return NextResponse.json(data, { status: 201 })
  } catch (error) { return apiError(error) }
}
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const input = await parseBody(request, z.object({ id, action: z.enum(['activate', 'complete']) }))
    const { data, error } = await supabase.rpc('transition_discipline_penalty', { p_id: input.id, p_action: input.action })
    if (error) return databaseError(error)
    return NextResponse.json(data)
  } catch (error) { return apiError(error) }
}
