import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { id } from '@/lib/validation'
import { apiError, databaseError, parseBody } from '@/lib/api'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const input = await parseBody(request, z.object({ rewardId: id, requestId: id, note: z.string().max(4000).optional() }))
    const { data, error } = await supabase.rpc('redeem_discipline_reward', { p_reward_id: input.rewardId, p_request_id: input.requestId, p_note: input.note || null })
    if (error) return databaseError(error)
    return NextResponse.json(data)
  } catch (error) { return apiError(error) }
}
