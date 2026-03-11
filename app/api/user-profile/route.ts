import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, email, avatar_url, full_name')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error);
    }

    // Get user stats (level, XP, streak, points, discipline, penalties, rank id)
    const { data: userStats, error: statsError } = await supabase
      .from('user_stats')
      .select(
        'current_level, current_xp, xp_to_next_level, current_rank_id, current_streak_days, reward_points_balance, discipline_score, total_penalties_points',
      )
      .eq('user_id', user.id)
      .single();

    if (statsError && statsError.code !== 'PGRST116') {
      console.error('Error fetching user stats:', statsError);
    }

    // Get user rank code + name
    let rankName = 'F-Rank'; // Default rank
    let rankCode: string | null = null;

    if (userStats?.current_rank_id) {
      const { data: rankData } = await supabase
        .from('rank_definitions')
        .select('name, code')
        .eq('id', userStats.current_rank_id)
        .single();

      if (rankData) {
        rankName = rankData.name;
        rankCode = rankData.code;
      }
    }

    return NextResponse.json({
      username: profile?.username || user.email?.split('@')[0] || 'User',
      fullName: profile?.full_name || '',
      email: profile?.email || user.email,
      avatar: profile?.avatar_url || null,
      level: userStats?.current_level || 1,
      currentXP: userStats?.current_xp || 0,
      requiredXP: userStats?.xp_to_next_level || 100,
      rank: rankName,
      rankCode: rankCode,
      currentRankId: userStats?.current_rank_id || null,
      points: userStats?.reward_points_balance || 0,
      disciplineScore: userStats?.discipline_score || 0,
      penaltyPoints: userStats?.total_penalties_points || 0,
      streakDays: userStats?.current_streak_days || 0,
    });
  } catch (error) {
    console.error('Error in user profile API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { username, fullName, avatar_url } = body;

    // Update profile
    const { error } = await supabase
      .from('profiles')
      .update({
        username: username || undefined,
        full_name: fullName || undefined,
        avatar_url: avatar_url || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in user profile API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
