import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const toUtcIsoFromLocal = (
  date: string,
  time: string,
  timezoneOffsetMinutes: number,
) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    throw new Error('Invalid date/time format');
  }

  // timezoneOffsetMinutes follows Date#getTimezoneOffset:
  // UTC = local time + offset minutes.
  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute, 0, 0) +
    timezoneOffsetMinutes * 60_000;

  return new Date(utcMs).toISOString();
};

export async function POST(request: Request) {
  try {
    console.log('[v0] POST /api/quests called');
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[v0] Request body:', body);

    const {
      title,
      description,
      category,
      rank,
      date,
      startTime,
      endTime,
      xp,
      points,
      penalty,
      minusPoints,
      fixed,
      recurring,
      recurringPattern,
      timezoneOffsetMinutes,
    } = body;

    if (!title || !date) {
      return NextResponse.json(
        { error: 'Title and date are required' },
        { status: 400 },
      );
    }

    // Convert local date/time from client to UTC deterministically,
    // so server timezone never shifts quest times.
    const offsetMinutes =
      typeof timezoneOffsetMinutes === 'number' ? timezoneOffsetMinutes : 0;
    const hasSpecificTime = Boolean(startTime && endTime);
    const plannedStart = hasSpecificTime
      ? toUtcIsoFromLocal(date, startTime, offsetMinutes)
      : null;
    const plannedEnd = hasSpecificTime
      ? toUtcIsoFromLocal(date, endTime, offsetMinutes)
      : null;

    const estimatedMinutes =
      plannedStart && plannedEnd
        ? Math.round(
            (new Date(plannedEnd).getTime() - new Date(plannedStart).getTime()) /
              (1000 * 60),
          )
        : null;

    // Insert quest
    const { data: quest, error } = await supabase
      .from('quests')
      .insert([
        {
          user_id: user.id,
          title: title.trim(),
          description: description || null,
          // store category as ID (string) if provided
          category: category || null,
          rank_id: rank || null,
          date,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          estimated_minutes: estimatedMinutes,
          status: 'pending',
          xp_reward: xp || 0,
          reward_points: points || 0,
          penalties_points: penalty || 0,
          max_minus_points: minusPoints || 0,
          current_minus_points: 0,
          is_fixed: fixed || false,
          is_recurring: recurring || false,
          recurrence_rule: recurringPattern
            ? `FREQ=${recurringPattern.toUpperCase()}`
            : null,
        },
      ])
      .select()
      .single();

    console.log('[v0] Insert result:', { quest, error });

    if (error) {
      console.error('[v0] Database error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create quest' },
        { status: 500 },
      );
    }

    console.log('[v0] Quest created successfully:', quest);
    return NextResponse.json({ quest }, { status: 201 });
  } catch (error) {
    console.error('[v0] Error in quests API:', error);
    return NextResponse.json(
      {
        error:
          'Internal server error: ' +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    console.log('[v0] GET /api/quests called');
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch quests with rank data
    const { data: quests, error } = await supabase
      .from('quests')
      .select(
        `
        *,
        rank_definitions (
          id,
          code,
          name
        )
      `,
      )
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('planned_start', { ascending: true });

    if (error) {
      console.error('[v0] Error fetching quests:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch quests' },
        { status: 500 },
      );
    }

    // Transform quests to include rank information at top level
    const transformedQuests =
      quests?.map((quest: { rank_definitions?: { code: string; name: string } }) => ({
        ...quest,
        rank_code: quest.rank_definitions?.code,
        rank_name: quest.rank_definitions?.name,
      })) || [];

    console.log('[v0] Fetched quests:', transformedQuests);
    return NextResponse.json({ quests: transformedQuests });
  } catch (error) {
    console.error('[v0] Error in quests GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// PATCH /api/quests – update quest status (and timing)
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      status,
      title,
      description,
      category,
      rank,
      date,
      startTime,
      endTime,
      xp,
      points,
      penalty,
      minusPoints,
      fixed,
      recurring,
      recurringPattern,
      timezoneOffsetMinutes,
    } = body as {
      id?: string;
      status?: 'pending' | 'in-progress' | 'completed' | 'delayed' | 'cancelled';
      title?: string;
      description?: string;
      category?: string | null;
      rank?: string | null;
      date?: string;
      startTime?: string | null;
      endTime?: string | null;
      xp?: number;
      points?: number;
      penalty?: number;
      minusPoints?: number;
      fixed?: boolean;
      recurring?: boolean;
      recurringPattern?: string;
      timezoneOffsetMinutes?: number;
    };

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 },
      );
    }

    // Load current quest before updating so we can calculate schedule shifts / recurrence
    const { data: currentQuest, error: currentQuestError } = await supabase
      .from('quests')
      .select(
        'id, user_id, title, description, category, rank_id, date, planned_start, planned_end, is_fixed, status, xp_reward, reward_points, penalties_points, max_minus_points, current_minus_points, actual_start, actual_end, shifted_by_minutes, estimated_minutes, is_recurring, recurrence_rule',
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (currentQuestError || !currentQuest) {
      return NextResponse.json(
        { error: 'Quest not found' },
        { status: 404 },
      );
    }

    const nowIso = new Date().toISOString();
    const updates: Record<string, unknown> = {
      updated_at: nowIso,
    };

    // Status-only updates (Start / Done buttons)
    if (status) {
      updates.status = status;
      if (status === 'in-progress') {
        updates.actual_start = nowIso;
      }
      if (status === 'completed') {
        updates.actual_end = nowIso;
      }
    }

    // Full field updates from the Edit form
    if (title !== undefined) {
      updates.title = title.trim();
    }
    if (description !== undefined) {
      updates.description = description || null;
    }
    if (category !== undefined) {
      updates.category = category || null;
    }
    if (date !== undefined) {
      updates.date = date;
    }
    if (date && startTime && endTime) {
      const offsetMinutes =
        typeof timezoneOffsetMinutes === 'number' ? timezoneOffsetMinutes : 0;
      const plannedStart = toUtcIsoFromLocal(date, startTime, offsetMinutes);
      const plannedEnd = toUtcIsoFromLocal(date, endTime, offsetMinutes);
      updates.planned_start = plannedStart;
      updates.planned_end = plannedEnd;
      updates.estimated_minutes = Math.round(
        (new Date(plannedEnd).getTime() - new Date(plannedStart).getTime()) /
          (1000 * 60),
      );
    } else if (date && (startTime === null || endTime === null)) {
      updates.planned_start = null;
      updates.planned_end = null;
      updates.estimated_minutes = null;
    }
    if (rank !== undefined) {
      updates.rank_id = rank || null;
    }
    if (xp !== undefined) {
      updates.xp_reward = xp;
    }
    if (points !== undefined) {
      updates.reward_points = points;
    }
    if (penalty !== undefined) {
      updates.penalties_points = penalty;
    }
    if (minusPoints !== undefined) {
      updates.max_minus_points = minusPoints;
    }
    if (fixed !== undefined) {
      updates.is_fixed = fixed;
    }
    if (recurring !== undefined) {
      updates.is_recurring = recurring;
    }
    if (recurring !== undefined && recurringPattern !== undefined && date) {
      updates.recurrence_rule = recurring
        ? `FREQ=${recurringPattern.toUpperCase()}`
        : null;
    }

    const { error } = await supabase
      .from('quests')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[v0] Error updating quest:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update quest' },
        { status: 500 },
      );
    }

    // "Not Done" (cancelled) behavior:
    // - Add only quest.penalties_points to user_stats.total_penalties_points
    // - Reset delayed minus points (current_minus_points) to 0
    if (status === 'cancelled' && currentQuest.status !== 'cancelled') {
      try {
        const penaltyPointsToAdd = currentQuest.penalties_points || 0;

        await supabase
          .from('quests')
          .update({
            current_minus_points: 0,
            updated_at: nowIso,
          })
          .eq('id', currentQuest.id)
          .eq('user_id', user.id);

        if (penaltyPointsToAdd > 0) {
          const { data: penaltyStats } = await supabase
            .from('user_stats')
            .select('id, total_penalties_points')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!penaltyStats) {
            await supabase.from('user_stats').insert({
              user_id: user.id,
              current_level: 1,
              current_xp: 0,
              total_xp_earned: 0,
              xp_to_next_level: 100,
              reward_points_balance: 0,
              total_penalties_points: penaltyPointsToAdd,
              current_rank_id: null,
            });
          } else {
            const currentTotal = penaltyStats.total_penalties_points ?? 0;
            await supabase
              .from('user_stats')
              .update({
                total_penalties_points: currentTotal + penaltyPointsToAdd,
                updated_at: nowIso,
              })
              .eq('user_id', user.id);
          }
        }
      } catch (cancelPenaltyError) {
        console.error('[v0] Error applying not-done penalty points:', cancelPenaltyError);
      }
    }

    // Track minus points delta
    let minusPointsChange = 0;

    if (status === 'completed') {
      const actualEnd = new Date(nowIso);

      // Penalty logic for completed quests
      try {
        const plannedEndForDelay = currentQuest.planned_end
          ? new Date(currentQuest.planned_end)
          : null;

        let delayMinutesForPenalty = 0;
        if (plannedEndForDelay) {
          delayMinutesForPenalty = Math.max(
            0,
            Math.round(
              (actualEnd.getTime() - plannedEndForDelay.getTime()) /
                (1000 * 60),
            ),
          );
        }

        const maxMinusPoints = currentQuest.max_minus_points || 0;
        const previousCurrentMinus = currentQuest.current_minus_points || 0;
        const previousPenaltyPoints = currentQuest.penalties_points || 0;

        let newCurrentMinus = previousCurrentMinus;
        let newPenaltyPoints = previousPenaltyPoints;

        // New delay -> minus points logic:
        // - Use total delay minutes
        // - 0 minutes => 0 points
        // - 1–60 minutes => 1 point, 61–119 => 2 points, etc. (ceil(minutes / 60))
        // - Respect max_minus_points unless it is 0 (0 means "no cap")
        if (delayMinutesForPenalty > 0) {
          const rawPoints = Math.ceil(delayMinutesForPenalty / 60);
          if (maxMinusPoints > 0) {
            newCurrentMinus = Math.min(rawPoints, maxMinusPoints);
          } else {
            newCurrentMinus = rawPoints;
          }
          newPenaltyPoints = 0;
        } else {
          newCurrentMinus = 0;
          newPenaltyPoints = 0;
        }

        minusPointsChange =
          (newCurrentMinus - previousCurrentMinus) +
          (newPenaltyPoints - previousPenaltyPoints);

        // Only hit the database if something actually changed
        if (minusPointsChange !== 0) {
          await supabase
            .from('quests')
            .update({
              current_minus_points: newCurrentMinus,
              penalties_points: newPenaltyPoints,
              updated_at: nowIso,
            })
            .eq('id', currentQuest.id)
            .eq('user_id', user.id);
        }

        // Add delay penalty points to user_stats.total_penalties_points
        if (newCurrentMinus > 0) {
          try {
            const { data: penaltyStats } = await supabase
              .from('user_stats')
              .select('id, total_penalties_points')
              .eq('user_id', user.id)
              .maybeSingle();

            if (!penaltyStats) {
              await supabase.from('user_stats').insert({
                user_id: user.id,
                current_level: 1,
                current_xp: 0,
                total_xp_earned: 0,
                xp_to_next_level: 100,
                reward_points_balance: 0,
                total_penalties_points: newCurrentMinus,
                current_rank_id: null,
              });
            } else {
              const currentTotal = penaltyStats.total_penalties_points ?? 0;
              await supabase
                .from('user_stats')
                .update({
                  total_penalties_points: currentTotal + newCurrentMinus,
                  updated_at: nowIso,
                })
                .eq('user_id', user.id);
            }
          } catch (statsErr) {
            console.error('[v0] Error updating total_penalties_points (delay):', statsErr);
          }
        }
      } catch (penaltyError) {
        console.error('[v0] Error applying quest penalties:', penaltyError);
      }

      // Recurring quests: when a recurring quest is completed, create the next occurrence
      try {
        if (currentQuest.is_recurring && currentQuest.recurrence_rule && currentQuest.date) {
          // recurrence_rule is stored as e.g. "FREQ=DAILY" / "FREQ=WEEKLY" / "FREQ=MONTHLY" / "FREQ=YEARLY"
          const freqPart = String(currentQuest.recurrence_rule).split('=')[1] || '';
          const freq = freqPart.toUpperCase();

          const currentDate = new Date(currentQuest.date + 'T00:00:00Z');
          const nextDate = new Date(currentDate);

          if (freq === 'DAILY') {
            nextDate.setUTCDate(currentDate.getUTCDate() + 1);
          } else if (freq === 'WEEKLY') {
            nextDate.setUTCDate(currentDate.getUTCDate() + 7);
          } else if (freq === 'MONTHLY') {
            nextDate.setUTCMonth(currentDate.getUTCMonth() + 1);
          } else if (freq === 'YEARLY') {
            nextDate.setUTCFullYear(currentDate.getUTCFullYear() + 1);
          } else {
            // Unknown frequency – do nothing
          }

          const nextDateStr = nextDate.toISOString().split('T')[0];

          let nextPlannedStart: string | null = null;
          let nextPlannedEnd: string | null = null;

          if (currentQuest.planned_start && currentQuest.planned_end) {
            const start = new Date(currentQuest.planned_start);
            const end = new Date(currentQuest.planned_end);
            const durationMs = end.getTime() - start.getTime();

            const baseStart = new Date(nextDateStr + 'T' + start.toISOString().split('T')[1]);
            nextPlannedStart = baseStart.toISOString();
            nextPlannedEnd = new Date(baseStart.getTime() + durationMs).toISOString();
          }

          await supabase.from('quests').insert({
            user_id: user.id,
            title: currentQuest.title,
            description: currentQuest.description,
            category: currentQuest.category,
            rank_id: currentQuest.rank_id,
            date: nextDateStr,
            planned_start: nextPlannedStart,
            planned_end: nextPlannedEnd,
            estimated_minutes: currentQuest.estimated_minutes,
            status: 'pending',
            xp_reward: currentQuest.xp_reward,
            reward_points: currentQuest.reward_points,
            penalties_points: currentQuest.penalties_points,
            max_minus_points: currentQuest.max_minus_points,
            current_minus_points: 0,
            is_fixed: currentQuest.is_fixed,
            is_recurring: true,
            recurrence_rule: currentQuest.recurrence_rule,
            shifted_by_minutes: 0,
          });
        }
      } catch (recurringError) {
        console.error('[v0] Error creating next recurring quest:', recurringError);
      }

      // A) Yesterday's unfinished quests: apply only penalty_points, reset current_minus_points
      try {
        const todayDateStr = nowIso.split('T')[0];
        const todayDate = new Date(`${todayDateStr}T00:00:00Z`);
        const yesterday = new Date(todayDate);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayDateStr = yesterday.toISOString().split('T')[0];

        // Run this rollover only once per user per day:
        // use a simple guard flag in user_settings (or rely on idempotent behavior if not set up).
        // For now, we assume the PATCH for the first completed quest of the day handles this once.
        {
          const { data: yesterdayQuests, error: yesterdayError } = await supabase
            .from('quests')
            .select(
              'id, status, penalties_points, current_minus_points, date',
            )
            .eq('user_id', user.id)
            .eq('date', yesterdayDateStr)
            .in('status', ['pending', 'in-progress', 'delayed']);

          if (!yesterdayError && yesterdayQuests && yesterdayQuests.length > 0) {
            let yesterdayPenaltyPointsToAdd = 0;

            for (const q of yesterdayQuests) {
              const prevPenalty = q.penalties_points || 0;
              const prevCurrentMinus = q.current_minus_points || 0;

              const newCurrentMinus = 0;
              const newPenaltyPoints = prevPenalty; // keep penalty_points as the only penalty

              const deltaMinus =
                (newCurrentMinus - prevCurrentMinus) +
                (newPenaltyPoints - prevPenalty);

              // Only update and log if something actually changed
              if (deltaMinus !== 0) {
                await supabase
                  .from('quests')
                  .update({
                    current_minus_points: newCurrentMinus,
                    penalties_points: newPenaltyPoints,
                    updated_at: nowIso,
                  })
                  .eq('id', q.id)
                  .eq('user_id', user.id);

                yesterdayPenaltyPointsToAdd += prevPenalty;
              }
            }

            if (yesterdayPenaltyPointsToAdd > 0) {
              try {
                const { data: penaltyStats } = await supabase
                  .from('user_stats')
                  .select('id, total_penalties_points')
                  .eq('user_id', user.id)
                  .maybeSingle();

                if (!penaltyStats) {
                  await supabase.from('user_stats').insert({
                    user_id: user.id,
                    current_level: 1,
                    current_xp: 0,
                    total_xp_earned: 0,
                    xp_to_next_level: 100,
                    reward_points_balance: 0,
                    total_penalties_points: yesterdayPenaltyPointsToAdd,
                    current_rank_id: null,
                  });
                } else {
                  const currentTotal = penaltyStats.total_penalties_points ?? 0;
                  await supabase
                    .from('user_stats')
                    .update({
                      total_penalties_points: currentTotal + yesterdayPenaltyPointsToAdd,
                      updated_at: nowIso,
                    })
                    .eq('user_id', user.id);
                }
              } catch (statsErr) {
                console.error('[v0] Error updating total_penalties_points (yesterday):', statsErr);
              }
            }
          }
        }
      } catch (yesterdayPenaltyError) {
        console.error(
          '[v0] Error applying penalties for previous day quests:',
          yesterdayPenaltyError,
        );
      }

      // 0) actual_minutes & shifted_by_minutes for this quest
      if (currentQuest.actual_start) {
        const actualStart = new Date(currentQuest.actual_start);
        const actualMinutes = Math.max(
          0,
          Math.round(
            (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60),
          ),
        );

        // shifted_by_minutes = actual_minutes - estimated_minutes (min 0)
        let estimatedMinutes = currentQuest.estimated_minutes || 0;
        // Fallback: if estimated_minutes is not set but we have planned_start/end, derive it
        if (
          !estimatedMinutes &&
          currentQuest.planned_start &&
          currentQuest.planned_end
        ) {
          const plannedStart = new Date(currentQuest.planned_start);
          const plannedEnd = new Date(currentQuest.planned_end);
          estimatedMinutes = Math.max(
            0,
            Math.round(
              (plannedEnd.getTime() - plannedStart.getTime()) / (1000 * 60),
            ),
          );
        }

        const shiftedByMinutes = Math.max(0, actualMinutes - estimatedMinutes);

        await supabase
          .from('quests')
          .update({
            actual_minutes: actualMinutes,
            shifted_by_minutes: shiftedByMinutes,
          })
          .eq('id', currentQuest.id)
          .eq('user_id', user.id);
      }

      // 1) If quest finished later than planned, shift the next directly-following fixed quest
      if (currentQuest.planned_end && currentQuest.is_fixed) {
        const plannedEnd = new Date(currentQuest.planned_end);

        if (actualEnd.getTime() > plannedEnd.getTime()) {
          // Find the next quest that starts exactly at the old planned_end on the same day
          const { data: nextQuest } = await supabase
            .from('quests')
            .select('id, planned_start, planned_end')
            .eq('user_id', user.id)
            .eq('date', currentQuest.date)
            .eq('planned_start', currentQuest.planned_end)
            .eq('is_fixed', true)
            .order('planned_start', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (nextQuest && nextQuest.planned_start && nextQuest.planned_end) {
            const originalStart = new Date(nextQuest.planned_start);
            const originalEnd = new Date(nextQuest.planned_end);
            const durationMs = originalEnd.getTime() - originalStart.getTime();

            const newStartIso = actualEnd.toISOString();
            const newEndIso = new Date(
              actualEnd.getTime() + durationMs,
            ).toISOString();

            await supabase
              .from('quests')
              .update({
                planned_start: newStartIso,
                planned_end: newEndIso,
                updated_at: nowIso,
              })
              .eq('id', nextQuest.id)
              .eq('user_id', user.id);
          }
        }
      }

      // 2) XP / reward points + level-up + rank progression
      try {
        const earnedXp = currentQuest.xp_reward || 0;
        const earnedRewardPoints = currentQuest.reward_points || 0;

        if (earnedXp !== 0 || earnedRewardPoints !== 0) {
          // Load or create user_stats row (include current_level, current_rank_id for level/rank logic)
          let { data: stats } = await supabase
            .from('user_stats')
            .select(
              'id, current_level, current_xp, total_xp_earned, xp_to_next_level, reward_points_balance, current_rank_id',
            )
            .eq('user_id', user.id)
            .maybeSingle();

          if (!stats) {
            const insertRes = await supabase
              .from('user_stats')
              .insert({
                user_id: user.id,
                current_level: 1,
                current_xp: 0,
                total_xp_earned: 0,
                xp_to_next_level: 100,
                reward_points_balance: 0,
                current_rank_id: null,
              })
              .select(
                'id, current_level, current_xp, total_xp_earned, xp_to_next_level, reward_points_balance, current_rank_id',
              )
              .single();
            stats = insertRes.data;
          }

          if (stats) {
            let currentLevel = stats.current_level ?? 1;
            let currentXp = (stats.current_xp || 0) + earnedXp;
            // L1→L2: 100 XP; each next level: +50 more (L2→L3: 150, L3→L4: 200, ...). So xp_to_next = 100 + (level - 1) * 50.
            let xpToNextLevel = stats.xp_to_next_level ?? 100;
            if (xpToNextLevel < 100) xpToNextLevel = 100 + (currentLevel - 1) * 50;
            let currentRankId = stats.current_rank_id ?? null;
            const newTotalXp = (stats.total_xp_earned || 0) + earnedXp;
            const newPointsBalance =
              (stats.reward_points_balance || 0) + earnedRewardPoints;

            while (currentXp >= xpToNextLevel) {
              const oldLevel = currentLevel;
              currentXp -= xpToNextLevel;
              currentLevel += 1;
              xpToNextLevel = 100 + (currentLevel - 1) * 50;

              await supabase.from('level_history').insert({
                user_id: user.id,
                old_level: oldLevel,
                new_level: currentLevel,
                xp_at_level_up: newTotalXp,
                created_at: nowIso,
              });

              // Check rank progression: any rule where from_rank_id = current rank and required_level <= new level
              const { data: progressionRules } = await supabase
                .from('rank_progression_rules')
                .select('id, from_rank_id, to_rank_id, required_level')
                .eq('user_id', user.id)
                .lte('required_level', currentLevel)
                .order('required_level', { ascending: false });

              const applicable = progressionRules?.filter(
                (r: { from_rank_id: string | null }) =>
                  (r.from_rank_id == null && currentRankId == null) ||
                  r.from_rank_id === currentRankId,
              );
              const rule = applicable?.[0];
              if (rule && rule.to_rank_id) {
                const fromRankId = rule.from_rank_id ?? null;
                const toRankId = rule.to_rank_id;
                await supabase.from('rank_history').insert({
                  user_id: user.id,
                  from_rank_id: fromRankId,
                  to_rank_id: toRankId,
                  level_reached: currentLevel,
                  created_at: nowIso,
                });
                currentRankId = toRankId;
              }
            }

            await supabase
              .from('user_stats')
              .update({
                current_level: currentLevel,
                current_xp: currentXp,
                total_xp_earned: newTotalXp,
                xp_to_next_level: xpToNextLevel,
                reward_points_balance: newPointsBalance,
                current_rank_id: currentRankId,
                updated_at: nowIso,
              })
              .eq('user_id', user.id);
          }
        }
      } catch (xpError) {
        console.error('[v0] Error updating XP/points/level/rank:', xpError);
      }

      // 3) Streak logic: if >= 80% of day's quests are completed, day counts toward streak
      try {
        // Compute completion ratio for the quest's date
        const { data: dayAgg, error: dayAggError } = await supabase
          .from('quests')
          .select('status', { count: 'exact', head: false })
          .eq('user_id', user.id)
          .eq('date', currentQuest.date);

        if (!dayAggError && dayAgg) {
          const totalTasks = dayAgg.length;
          const completedTasks = dayAgg.filter(
            (q: { status: string }) => q.status === 'completed',
          ).length;

          const qualified =
            totalTasks > 0 && completedTasks / totalTasks >= 0.8;

          // Load or create user_stats row
          let { data: stats } = await supabase
            .from('user_stats')
            .select('id, current_streak_days, longest_streak_days')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!stats) {
            const insertRes = await supabase
              .from('user_stats')
              .insert({
                user_id: user.id,
                current_streak_days: 0,
                longest_streak_days: 0,
              })
              .select('id, current_streak_days, longest_streak_days')
              .single();
            stats = insertRes.data;
          }

          if (stats) {
            // Check if today's streak log already exists
            const { data: todayLog } = await supabase
              .from('streak_logs')
              .select('qualified, streak_count_after_evaluation')
              .eq('user_id', user.id)
              .eq('date', currentQuest.date)
              .maybeSingle();

            // Avoid double-increment if already evaluated with the same result
            if (!todayLog || todayLog.qualified !== qualified) {
              // Get previous day's streak (only if previous day was qualified)
              const questDate = new Date(`${currentQuest.date}T00:00:00Z`);
              const prev = new Date(questDate);
              prev.setUTCDate(prev.getUTCDate() - 1);
              const prevDateStr = prev.toISOString().split('T')[0];

              let baseStreak = 0;
              const { data: prevLog } = await supabase
                .from('streak_logs')
                .select('qualified, streak_count_after_evaluation')
                .eq('user_id', user.id)
                .eq('date', prevDateStr)
                .maybeSingle();

              if (prevLog?.qualified && prevLog.streak_count_after_evaluation) {
                baseStreak = prevLog.streak_count_after_evaluation;
              }

              const newStreak = qualified ? baseStreak + 1 : 0;

              // Upsert today's streak_log
              await supabase.from('streak_logs').upsert(
                {
                  user_id: user.id,
                  date: currentQuest.date,
                  qualified,
                  reason: qualified
                    ? '>= 80% of quests completed'
                    : '< 80% of quests completed',
                  streak_count_after_evaluation: newStreak,
                },
                {
                  onConflict: 'user_id,date',
                },
              );

              // Update user_stats current and longest streak
              const longest =
                newStreak > (stats.longest_streak_days ?? 0)
                  ? newStreak
                  : stats.longest_streak_days ?? 0;

              await supabase
                .from('user_stats')
                .update({
                  current_streak_days: newStreak,
                  longest_streak_days: longest,
                  updated_at: nowIso,
                })
                .eq('user_id', user.id);
            }
          }
        }
      } catch (streakError) {
        console.error('[v0] Error updating streak:', streakError);
      }

    }

    // Quest logs for any status change (pending -> in-progress / completed / delayed / cancelled)
    try {
      const previousStatus = currentQuest.status;
      const newStatus = status || previousStatus;

      // Only log when status actually changes
      if (newStatus !== previousStatus) {
        let delayMinutes = 0;
        if (currentQuest.planned_end) {
          const plannedEnd = new Date(currentQuest.planned_end);
          const actualForDelay = new Date(nowIso);
          delayMinutes = Math.max(
            0,
            Math.round(
              (actualForDelay.getTime() - plannedEnd.getTime()) / (1000 * 60),
            ),
          );
        }

        // XP / reward points only matter when quest is completed
        const earnedXp =
          newStatus === 'completed' ? currentQuest.xp_reward || 0 : 0;
        const earnedRewardPoints =
          newStatus === 'completed' ? currentQuest.reward_points || 0 : 0;

      }
    } catch (logError) {
      console.error('[v0] Error inserting quest log:', logError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] Error in quests PATCH API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// DELETE /api/quests – delete quest
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from('quests')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[v0] Error deleting quest:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete quest' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] Error in quests DELETE API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

