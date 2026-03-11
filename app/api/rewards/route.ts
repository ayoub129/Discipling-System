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

    const { data: rewards, error } = await supabase
      .from('rewards')
      .select(
        `
        id,
        user_id,
        name,
        description,
        category,
        point_cost,
        minimum_level,
        minimum_rank_id,
        minimum_discipline_score,
        cooldown_hours,
        max_redemptions_per_week,
        is_active,
        is_global,
        created_at,
        updated_at,
        minimum_rank:rank_definitions!minimum_rank_id ( id, code, name )
      `,
      )
      .or(`user_id.eq.${user.id},is_global.eq.true`)
      .order('point_cost', { ascending: true });

    if (error) {
      console.error('[v0] Error fetching rewards:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch rewards' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      rewards: rewards || [],
    });
  } catch (error) {
    console.error('[v0] Error in rewards GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

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
    const {
      name,
      description,
      category,
      pointCost,
      minimumLevel,
      minimumRankId,
      minimumDisciplineScore,
      cooldownHours,
      maxRedemptionsPerWeek,
    } = body as {
      name: string;
      description?: string;
      category?: string;
      pointCost: number;
      minimumLevel: number;
      minimumRankId?: string | null;
      minimumDisciplineScore: number;
      cooldownHours: number;
      maxRedemptionsPerWeek?: number | null;
    };

    if (!name || !pointCost || !minimumLevel) {
      return NextResponse.json(
        { error: 'Name, pointCost, and minimumLevel are required' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('rewards')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description || null,
        category: category || null,
        point_cost: pointCost,
        minimum_level: minimumLevel,
        minimum_rank_id: minimumRankId || null,
        minimum_discipline_score: minimumDisciplineScore,
        cooldown_hours: cooldownHours,
        max_redemptions_per_week: maxRedemptionsPerWeek ?? null,
        is_active: true,
        is_global: false,
      })
      .select(
        `
        id,
        user_id,
        name,
        description,
        category,
        point_cost,
        minimum_level,
        minimum_rank_id,
        minimum_discipline_score,
        cooldown_hours,
        max_redemptions_per_week,
        is_active,
        is_global,
        created_at,
        updated_at,
        minimum_rank:rank_definitions!minimum_rank_id ( id, code, name )
      `,
      )
      .single();

    if (error) {
      console.error('[v0] Error creating reward:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create reward' },
        { status: 500 },
      );
    }

    return NextResponse.json({ reward: data }, { status: 201 });
  } catch (error) {
    console.error('[v0] Error in rewards POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

