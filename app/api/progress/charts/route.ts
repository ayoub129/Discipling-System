import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type Bucket = { label: string; xp: number; quests: number; rewardPoints: number; penalties: number };

function getTodayBuckets(): Bucket[] {
  const labels = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'];
  return labels.map((label) => ({
    label,
    xp: 0,
    quests: 0,
    rewardPoints: 0,
    penalties: 0,
  }));
}

function getWeekBuckets(): Bucket[] {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((label) => ({
    label,
    xp: 0,
    quests: 0,
    rewardPoints: 0,
    penalties: 0,
  }));
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'week';
    if (range !== 'today' && range !== 'week') {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const buckets: Bucket[] = range === 'today' ? getTodayBuckets() : getWeekBuckets();

    if (range === 'today') {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const d = now.getUTCDate();
      const todayStart = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
      const tomorrowStart = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));

      // Use quests table instead of quest_logs.
      // For today: all quests with today's date and status='completed'
      const { data: questsToday } = await supabase
        .from('quests')
        .select('date, planned_start, xp_reward, reward_points, status')
        .eq('user_id', user.id)
        .eq('date', todayStart.toISOString().split('T')[0])
        .eq('status', 'completed');

      const hourToIndex = (hour: number) => {
        if (hour >= 9 && hour <= 23) return hour - 9;
        return -1;
      };

      questsToday?.forEach(
        (row: {
          planned_start: string | null;
          xp_reward: number | null;
          reward_points: number | null;
        }) => {
          const t = row.planned_start ? new Date(row.planned_start) : null;
          if (!t) return;
          const hour = t.getUTCHours();
          const idx = hourToIndex(hour);
          if (idx >= 0) {
            buckets[idx].xp += row.xp_reward ?? 0;
            buckets[idx].rewardPoints += row.reward_points ?? 0;
            buckets[idx].quests += 1;
          }
        },
      );

      const { data: penalties } = await supabase
        .from('user_penalties')
        .select('issued_at')
        .eq('user_id', user.id)
        .gte('issued_at', todayStart.toISOString())
        .lt('issued_at', tomorrowStart.toISOString());

      penalties?.forEach((row: { issued_at: string }) => {
        const t = new Date(row.issued_at);
        const hour = t.getUTCHours();
        const idx = hourToIndex(hour);
        if (idx >= 0) buckets[idx].penalties += 1;
      });
    } else {
      // Week: Monday 00:00 UTC to next Monday 00:00 UTC
      const day = now.getUTCDay();
      const monOffset = day === 0 ? -6 : 1 - day;
      const mon = new Date(now);
      mon.setUTCDate(now.getUTCDate() + monOffset);
      mon.setUTCHours(0, 0, 0, 0);
      const nextMon = new Date(mon);
      nextMon.setUTCDate(mon.getUTCDate() + 7);

      // Week: aggregate from quests table by date for completed quests
      const { data: questsWeek } = await supabase
        .from('quests')
        .select('date, xp_reward, reward_points, status')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('date', mon.toISOString().split('T')[0])
        .lt('date', nextMon.toISOString().split('T')[0]);

      questsWeek?.forEach(
        (row: {
          date: string;
          xp_reward: number | null;
          reward_points: number | null;
        }) => {
          const t = new Date(row.date + 'T00:00:00Z');
          const dayOfWeek = t.getUTCDay();
          const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0 .. Sun=6
          if (idx >= 0 && idx < 7) {
            buckets[idx].xp += row.xp_reward ?? 0;
            buckets[idx].rewardPoints += row.reward_points ?? 0;
            buckets[idx].quests += 1;
          }
        },
      );

      const { data: penalties } = await supabase
        .from('user_penalties')
        .select('issued_at')
        .eq('user_id', user.id)
        .gte('issued_at', mon.toISOString())
        .lt('issued_at', nextMon.toISOString());

      penalties?.forEach((row: { issued_at: string }) => {
        const t = new Date(row.issued_at);
        const dayOfWeek = t.getUTCDay();
        const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        if (idx >= 0 && idx < 7) buckets[idx].penalties += 1;
      });
    }

    const xp = buckets.map((b) => ({ date: b.label, value: b.xp }));
    const quests = buckets.map((b) => ({ date: b.label, value: b.quests }));
    const rewardPoints = buckets.map((b) => ({ date: b.label, value: b.rewardPoints }));
    const penalties = buckets.map((b) => ({ date: b.label, value: b.penalties }));

    return NextResponse.json({
      range,
      xp,
      quests,
      rewardPoints,
      penalties,
    });
  } catch (error) {
    console.error('[progress/charts] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
