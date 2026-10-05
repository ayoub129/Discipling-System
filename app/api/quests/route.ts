import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, databaseError, parseBody } from '@/lib/api'
import { createQuest, editQuest, id, questValues } from '@/lib/validation'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const maintenance = await supabase.rpc('maintain_discipline_user')
    if (maintenance.error) return databaseError(maintenance.error)
    const quests = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('quests').select('*, rank_definitions(id,code,name)').eq('user_id', user.id).is('archived_at', null).order('date', { ascending: false }).order('planned_start', { ascending: true }).order('id').range(offset, offset + 499)
      if (error) return databaseError(error)
      quests.push(...(data || []))
      if (!data || data.length < 500) break
    }
    return NextResponse.json({ quests: quests.map(q => ({ ...q, rank_code: q.rank_definitions?.code, rank_name: q.rank_definitions?.name })) })
  } catch (error) { return apiError(error) }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const input = await parseBody(request, createQuest)
    const { data, error } = await supabase.rpc('save_discipline_quest', { p_values: questValues({ ...input, id: crypto.randomUUID() }) })
    if (error) return databaseError(error)
    return NextResponse.json({ quest: data }, { status: 201 })
  } catch (error) { return apiError(error) }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const input = await parseBody(request, editQuest)
    const result = input.status
      ? await supabase.rpc('transition_discipline_quest', { p_id: input.id, p_status: input.status })
      : await supabase.rpc('save_discipline_quest', { p_id: input.id, p_values: questValues(input) })
    if (result.error) return databaseError(result.error)
    return NextResponse.json({ success: true, quest: result.data?.quest || result.data })
  } catch (error) { return apiError(error) }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const input = await parseBody(request, z.object({ id }))
    const { error } = await supabase.rpc('archive_discipline_quest', { p_id: input.id })
    if (error) return databaseError(error)
    return NextResponse.json({ success: true })
  } catch (error) { return apiError(error) }
}
