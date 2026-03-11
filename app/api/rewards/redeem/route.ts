import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rewardId, note } = body as {
      rewardId?: string;
      note?: string;
    };

    if (!rewardId) {
      return NextResponse.json(
        { error: 'rewardId is required' },
        { status: 400 },
      );
    }

    // 1) Load reward to get point_cost and constraints
    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select(
        'id, point_cost, cooldown_hours, max_redemptions_per_week',
      )
      .eq('id', rewardId)
      .maybeSingle();

    if (rewardError || !reward) {
      return NextResponse.json(
        { error: 'Reward not found' },
        { status: 404 },
      );
    }

    const pointCost = reward.point_cost || 0;
    if (pointCost <= 0) {
      return NextResponse.json(
        { error: 'Reward has no point cost configured' },
        { status: 400 },
      );
    }

    const cooldownHours = reward.cooldown_hours || 0;
    const maxRedemptionsPerWeek = reward.max_redemptions_per_week;

    const now = new Date();
    const nowIso = now.toISOString();

    // 1a) Enforce cooldown: cannot redeem again within cooldown_hours since last redemption
    if (cooldownHours > 0) {
      const { data: lastRedemption } = await supabase
        .from('reward_redemptions')
        .select('redeemed_at')
        .eq('user_id', user.id)
        .eq('reward_id', reward.id)
        .order('redeemed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRedemption?.redeemed_at) {
        const lastTime = new Date(lastRedemption.redeemed_at);
        const nextAllowed = new Date(
          lastTime.getTime() + cooldownHours * 60 * 60 * 1000,
        );
        if (now < nextAllowed) {
          const diffMs = nextAllowed.getTime() - now.getTime();
          const diffMinutes = Math.ceil(diffMs / (60 * 1000));
          return NextResponse.json(
            {
              error: `Reward is on cooldown. Try again in ~${diffMinutes} minutes.`,
            },
            { status: 400 },
          );
        }
      }
    }

    // 1b) Enforce max_redemptions_per_week (rolling last 7 days)
    if (maxRedemptionsPerWeek !== null && maxRedemptionsPerWeek !== undefined) {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      const sevenDaysAgoIso = sevenDaysAgo.toISOString();

      const { data: recentRedemptions, error: recentError } = await supabase
        .from('reward_redemptions')
        .select('id, redeemed_at')
        .eq('user_id', user.id)
        .eq('reward_id', reward.id)
        .gte('redeemed_at', sevenDaysAgoIso)
        .lte('redeemed_at', nowIso);

      if (recentError) {
        console.error(
          '[v0] Error checking weekly redemption limit:',
          recentError,
        );
        return NextResponse.json(
          { error: 'Failed to validate reward redemption limits' },
          { status: 500 },
        );
      }

      const count = recentRedemptions?.length ?? 0;
      if (count >= maxRedemptionsPerWeek) {
        return NextResponse.json(
          {
            error: `Weekly redemption limit reached (${maxRedemptionsPerWeek}x in the last 7 days).`,
          },
          { status: 400 },
        );
      }
    }

    // 2) Load user_stats to get current points
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('id, reward_points_balance')
      .eq('user_id', user.id)
      .maybeSingle();

    if (statsError) {
      console.error('[v0] Error loading user_stats for redemption:', statsError);
      return NextResponse.json(
        { error: 'Failed to load user stats' },
        { status: 500 },
      );
    }

    const currentBalance = stats?.reward_points_balance || 0;
    if (currentBalance < pointCost) {
      return NextResponse.json(
        { error: 'Not enough points to redeem this reward' },
        { status: 400 },
      );
    }

    // 3) Create reward_redemptions row
    const { data: redemption, error: redemptionError } = await supabase
      .from('reward_redemptions')
      .insert({
        user_id: user.id,
        reward_id: reward.id,
        point_cost: pointCost,
        note: note || null,
      })
      .select('id, reward_id, point_cost, redeemed_at, note')
      .single();

    if (redemptionError) {
      console.error('[v0] Error creating reward redemption:', redemptionError);
      return NextResponse.json(
        { error: redemptionError.message || 'Failed to redeem reward' },
        { status: 500 },
      );
    }

    // 4) Subtract points from user_stats
    const newBalance = currentBalance - pointCost;

    const { error: updateStatsError } = await supabase
      .from('user_stats')
      .update({
        reward_points_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateStatsError) {
      console.error(
        '[v0] Error updating user points after redemption:',
        updateStatsError,
      );
      // We already created a redemption row; report error so UI can reflect issue
      return NextResponse.json(
        { error: 'Reward redeemed, but failed to update points balance' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      redemption,
      newBalance,
    });
  } catch (error) {
    console.error('[v0] Error in rewards redeem API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

