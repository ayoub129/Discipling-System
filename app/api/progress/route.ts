import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // User stats
    const { data: userStats, error: statsError } = await supabase
      .from('user_stats')
      .select(
        'current_level, current_xp, xp_to_next_level, total_xp_earned, current_rank_id, current_streak_days, longest_streak_days, reward_points_balance, total_penalties_points',
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (statsError) {
      console.error('[progress] Error fetching user_stats:', statsError);
      return NextResponse.json(
        { error: statsError.message || 'Failed to fetch stats' },
        { status: 500 },
      );
    }

    // Rank name
    let rankName = 'F-Rank';
    if (userStats?.current_rank_id) {
      const { data: rankData } = await supabase
        .from('rank_definitions')
        .select('name')
        .eq('id', userStats.current_rank_id)
        .single();
      if (rankData?.name) rankName = rankData.name;
    }

    // Total quests completed (count from quests table)
    const { count: questsCompletedCount, error: questsError } = await supabase
      .from('quests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    if (questsError) {
      console.error('[progress] Error counting quests:', questsError);
    }

    // Penalties triggered = count of user_penalties rows
    const { count: penaltiesCount, error: penaltiesError } = await supabase
      .from('user_penalties')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (penaltiesError) {
      console.error('[progress] Error counting user_penalties:', penaltiesError);
    }

    // Total rewards redeemed = count of reward_redemptions
    const { count: rewardsRedeemedCount, error: redemptionsError } =
      await supabase
        .from('reward_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

    if (redemptionsError) {
      console.error('[progress] Error counting reward_redemptions:', redemptionsError);
    }

    // Rank history (from rank_history table)
    const { data: rankHistoryRows, error: rankHistoryError } = await supabase
      .from('rank_history')
      .select(
        'id, from_rank_id, to_rank_id, level_reached, created_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (rankHistoryError) {
      console.error('[progress] Error fetching rank_history:', rankHistoryError);
    }

    const rankIds = new Set<string>();
    rankHistoryRows?.forEach((r: { from_rank_id: string | null; to_rank_id: string }) => {
      if (r.from_rank_id) rankIds.add(r.from_rank_id);
      if (r.to_rank_id) rankIds.add(r.to_rank_id);
    });
    const rankIdList = Array.from(rankIds);
    let rankNames: Record<string, string> = {};
    if (rankIdList.length > 0) {
      const { data: rankDefs } = await supabase
        .from('rank_definitions')
        .select('id, name')
        .in('id', rankIdList);
      rankDefs?.forEach((r: { id: string; name: string }) => {
        rankNames[r.id] = r.name;
      });
    }

    const rankHistory = (rankHistoryRows ?? []).map(
      (r: { from_rank_id: string | null; to_rank_id: string; level_reached: number; created_at: string }) => ({
        date: r.created_at,
        oldRank: rankNames[r.from_rank_id ?? ''] ?? '—',
        newRank: rankNames[r.to_rank_id] ?? '—',
        levelReached: r.level_reached,
      }),
    );

    // Level history (from level_history table) for Level Progression Timeline
    const { data: levelHistoryRows, error: levelHistoryError } = await supabase
      .from('level_history')
      .select('old_level, new_level, xp_at_level_up, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (levelHistoryError) {
      console.error('[progress] Error fetching level_history:', levelHistoryError);
    }

    const levelHistory = (levelHistoryRows ?? []).map(
      (r: { old_level: number; new_level: number; xp_at_level_up: number; created_at: string }) => ({
        oldLevel: r.old_level,
        newLevel: r.new_level,
        xpAtLevelUp: r.xp_at_level_up,
        date: r.created_at,
      }),
    );

    return NextResponse.json({
      currentLevel: userStats?.current_level ?? 1,
      currentRank: rankName,
      totalXpEarned: userStats?.total_xp_earned ?? 0,
      currentStreakDays: userStats?.current_streak_days ?? 0,
      longestStreakDays: userStats?.longest_streak_days ?? 0,
      xpToNextLevel: userStats?.xp_to_next_level ?? 100,
      totalQuestsCompleted: questsCompletedCount ?? 0,
      totalPenaltiesTriggered: penaltiesCount ?? 0,
      totalRewardsRedeemed: rewardsRedeemedCount ?? 0,
      rewardPointsBalance: userStats?.reward_points_balance ?? 0,
      totalPenaltiesPoints: userStats?.total_penalties_points ?? 0,
      rankHistory,
      levelHistory,
    });
  } catch (error) {
    console.error('[progress] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
