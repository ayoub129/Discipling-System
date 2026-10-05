import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, databaseError, parseBody } from '@/lib/api'
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const maintenance = await supabase.rpc('maintain_discipline_user')
    if (maintenance.error) return databaseError(maintenance.error)
    const [profile, stats, settings] = await Promise.all([
      supabase.from('profiles').select('username,avatar_url,full_name').eq('id', user.id).single(),
      supabase.from('user_stats').select('*').eq('user_id', user.id).single(),
      supabase.from('user_settings').select('timezone').eq('user_id', user.id).single(),
    ])
    if (profile.error) return databaseError(profile.error)
    if (stats.error) return databaseError(stats.error)
    if (settings.error) return databaseError(settings.error)
    let avatar = profile.data.avatar_url
    if (avatar?.startsWith(`storage:${user.id}/`)) {
      const signed = await supabase.storage.from('discipline-avatars').createSignedUrl(avatar.slice(8), 3600)
      avatar = signed.data?.signedUrl || null
    }
    const { data: rank } = stats.data.current_rank_id ? await supabase.from('rank_definitions').select('name,code').eq('id', stats.data.current_rank_id).eq('user_id', user.id).maybeSingle() : { data: null }
    return NextResponse.json({ username: profile.data.username || user.email?.split('@')[0] || 'User', fullName: profile.data.full_name || '', email: user.email, avatar,
      level: stats.data.current_level, currentXP: stats.data.current_xp, requiredXP: stats.data.xp_to_next_level, rank: rank?.name || 'F-Rank', rankCode: rank?.code || null, currentRankId: stats.data.current_rank_id,
      points: stats.data.reward_points_balance, disciplineScore: stats.data.discipline_score, penaltyPoints: stats.data.total_penalties_points, streakDays: stats.data.current_streak_days, timezone: settings.data.timezone })
  } catch (error) { return apiError(error) }
}
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const input = await parseBody(request, z.object({ username: z.string().trim().min(1).max(80), fullName: z.string().trim().max(120), avatar_url: z.union([z.string().url().refine(v => v.startsWith('https://'), 'Use an HTTPS image URL'), z.literal('')]).optional() }))
    const signedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/sign/discipline-avatars/${user.id}/`
    const keepStoredAvatar = input.avatar_url?.startsWith(signedPrefix)
    const { error } = await supabase.from('profiles').update({ username: input.username, full_name: input.fullName, ...(input.avatar_url !== undefined && !keepStoredAvatar ? { avatar_url: input.avatar_url || null } : {}), updated_at: new Date().toISOString() }).eq('id', user.id)
    if (error) return databaseError(error)
    return NextResponse.json({ success: true })
  } catch (error) { return apiError(error) }
}
