import { z } from 'zod'
import { zonedTimeToIso } from './time'

export const id = z.string().uuid('Invalid item identifier')
export const amount = z.number().int().min(0).max(10000)
export const shortText = z.string().trim().min(1).max(200)
export const description = z.string().trim().max(4000).optional()
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}, 'Invalid calendar date')
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid 24-hour time')
export const timezone = z.string().max(100).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}, 'Invalid timezone')
const questFields = z.object({
  title: shortText, description,
  category: z.union([id, z.literal(''), z.null()]).optional(),
  rank: z.union([id, z.literal(''), z.null()]).optional(),
  date, startTime: time.nullable().optional(), endTime: time.nullable().optional(),
  xp: amount.optional(), points: amount.optional(), penalty: amount.optional(), minusPoints: amount.optional(),
  fixed: z.boolean().optional(), recurring: z.boolean().optional(),
  recurringPattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  timezone: timezone.optional(),
})
function validTimes(value: { startTime?: string | null; endTime?: string | null }) {
  if (!value.startTime && !value.endTime) return true
  return Boolean(value.startTime && value.endTime && value.endTime > value.startTime)
}
export const createQuest = questFields.refine(validTimes, 'End time must follow start time on the same day')
export const editQuest = questFields.partial().extend({ id, status: z.enum(['pending', 'in-progress', 'completed', 'delayed', 'cancelled']).optional() })
  .refine(validTimes, 'End time must follow start time on the same day')
  .refine(value => !value.status || Object.keys(value).every(key => key === 'id' || key === 'status'), 'Change status separately from editing a quest')
export const rewardFields = z.object({
  name: shortText, description, category: z.string().trim().max(100).optional(),
  pointCost: amount.refine(v => v > 0), minimumLevel: z.number().int().min(1).max(1000),
  minimumRankId: id.nullable().optional(), minimumDisciplineScore: z.number().int().min(0).max(100),
  cooldownHours: z.number().int().min(0).max(8760),
  maxRedemptionsPerWeek: z.number().int().min(0).max(1000).nullable().optional(),
})
export const penaltyFields = z.object({
  title: shortText, description, severityOrder: z.number().int().min(1).max(100),
  triggerPoints: amount.refine(v => v > 0), xpLossIfMissed: amount,
  dueInHours: z.number().int().min(1).max(8760),
})

export function questValues(input: z.infer<typeof editQuest>) {
  const values: Record<string, unknown> = {}
  const fields = { title: 'title', description: 'description', date: 'date', category: 'category', rank: 'rank_id', xp: 'xp_reward', points: 'reward_points', penalty: 'penalties_points', minusPoints: 'max_minus_points', fixed: 'is_fixed', recurring: 'is_recurring', timezone: 'timezone' }
  for (const [key, column] of Object.entries(fields)) {
    const value = input[key as keyof typeof input]
    if (value !== undefined) values[column] = value === '' ? null : value
  }
  if (input.recurring !== undefined) values.recurrence_rule = input.recurring ? `FREQ=${(input.recurringPattern || 'daily').toUpperCase()}` : null
  if (input.startTime && input.endTime && input.date) {
    const offset = input.timezoneOffsetMinutes ?? 0
    const start = input.timezone ? new Date(zonedTimeToIso(input.date, input.startTime, input.timezone)).getTime() : new Date(`${input.date}T${input.startTime}:00Z`).getTime() + offset * 60000
    const end = input.timezone ? new Date(zonedTimeToIso(input.date, input.endTime, input.timezone)).getTime() : new Date(`${input.date}T${input.endTime}:00Z`).getTime() + offset * 60000
    values.planned_start = new Date(start).toISOString()
    values.planned_end = new Date(end).toISOString()
    values.estimated_minutes = (end - start) / 60000
  } else if (input.startTime === null || input.endTime === null) {
    values.planned_start = null; values.planned_end = null; values.estimated_minutes = null
  }
  return values
}
