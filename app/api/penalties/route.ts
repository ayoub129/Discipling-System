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

    const nowIso = new Date().toISOString();

    // Penalty definitions
    const { data: definitions, error: defError } = await supabase
      .from('penalty_definitions')
      .select(
        'id, name, description, severity_order, trigger_points, xp_loss_if_missed, due_in_hours, is_active',
      )
      .eq('user_id', user.id)
      .order('severity_order', { ascending: true });

    if (defError) {
      console.error('[v0] Error fetching penalty definitions:', defError);
      return NextResponse.json(
        { error: defError.message || 'Failed to fetch penalties' },
        { status: 500 },
      );
    }

    // User penalties
    const { data: userPenalties, error: userPenError } = await supabase
      .from('user_penalties')
      .select(
        `
        id,
        user_id,
        penalty_definition_id,
        title,
        description,
        status,
        issued_at,
        due_at,
        completed_at,
        xp_lost_applied,
        xp_lost,
        penalty_definitions (
          severity_order,
          trigger_points,
          xp_loss_if_missed,
          due_in_hours
        )
      `,
      )
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false });

    if (userPenError) {
      console.error('[v0] Error fetching user penalties:', userPenError);
      return NextResponse.json(
        { error: userPenError.message || 'Failed to fetch user penalties' },
        { status: 500 },
      );
    }

    const totalDefinitions = definitions?.length ?? 0;
    const totalXpLost =
      userPenalties?.reduce(
        (sum, p: any) => sum + (p.xp_lost ?? 0),
        0,
      ) ?? 0;

    const activeCount =
      userPenalties?.filter((p: any) =>
        ['created', 'in-progress', 'active'].includes(p.status),
      ).length ?? 0;

    return NextResponse.json({
      definitions: definitions || [],
      userPenalties: userPenalties || [],
      stats: {
        totalDefinitions,
        totalXpLost,
        activeCount,
        now: nowIso,
      },
    });
  } catch (error) {
    console.error('[v0] Error in penalties GET API:', error);
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
      title,
      description,
      severityOrder,
      triggerPoints,
      xpLossIfMissed,
      dueInHours,
    } = body as {
      title: string;
      description?: string;
      severityOrder: number;
      triggerPoints: number;
      xpLossIfMissed: number;
      dueInHours: number;
    };

    if (!title || !triggerPoints || !dueInHours) {
      return NextResponse.json(
        { error: 'Title, triggerPoints and dueInHours are required' },
        { status: 400 },
      );
    }

    const now = new Date();
    const issuedAt = now.toISOString();
    const dueAt = new Date(
      now.getTime() + dueInHours * 60 * 60 * 1000,
    ).toISOString();

    // Create definition
    const { data: def, error: defError } = await supabase
      .from('penalty_definitions')
      .insert({
        user_id: user.id,
        name: title.trim(),
        description: description || null,
        severity_order: severityOrder,
        trigger_points: triggerPoints,
        xp_loss_if_missed: xpLossIfMissed,
        due_in_hours: dueInHours,
        is_active: false,
      })
      .select(
        'id, name, description, severity_order, trigger_points, xp_loss_if_missed, due_in_hours, is_active',
      )
      .single();

    if (defError || !def) {
      console.error('[v0] Error creating penalty definition:', defError);
      return NextResponse.json(
        { error: defError?.message || 'Failed to create penalty definition' },
        { status: 500 },
      );
    }

    // Create user penalty instance with status "created"
    const { data: userPenalty, error: upError } = await supabase
      .from('user_penalties')
      .insert({
        user_id: user.id,
        penalty_definition_id: def.id,
        title: title.trim(),
        description: description || null,
        status: 'created',
        issued_at: issuedAt,
        due_at: dueAt,
        xp_lost_applied: false,
        xp_lost: 0,
      })
      .select(
        `
        id,
        user_id,
        penalty_definition_id,
        title,
        description,
        status,
        issued_at,
        due_at,
        completed_at,
        xp_lost_applied,
        xp_lost,
        penalty_definitions (
          severity_order,
          trigger_points,
          xp_loss_if_missed,
          due_in_hours
        )
      `,
      )
      .single();

    if (upError || !userPenalty) {
      console.error('[v0] Error creating user penalty:', upError);
      return NextResponse.json(
        { error: upError?.message || 'Failed to create user penalty' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { definition: def, userPenalty },
      { status: 201 },
    );
  } catch (error) {
    console.error('[v0] Error in penalties POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

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
    const { id, action } = body as {
      id?: string;
      action?: 'activate' | 'complete';
    };

    if (!id || !action) {
      return NextResponse.json(
        { error: 'id and action are required' },
        { status: 400 },
      );
    }

    // Load user penalty + definition
    const { data: penalty, error: penaltyError } = await supabase
      .from('user_penalties')
      .select(
        `
        id,
        user_id,
        penalty_definition_id,
        title,
        description,
        status,
        issued_at,
        due_at,
        completed_at,
        xp_lost_applied,
        xp_lost,
        penalty_definitions (
          id,
          trigger_points,
          xp_loss_if_missed,
          due_in_hours,
          is_active
        )
      `,
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (penaltyError || !penalty) {
      return NextResponse.json(
        { error: 'Penalty not found' },
        { status: 404 },
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Load user_stats for penalty points and XP
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select(
        'id, total_penalties_points, current_xp, total_xp_earned',
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (statsError) {
      console.error('[v0] Error loading user_stats for penalties:', statsError);
      return NextResponse.json(
        { error: 'Failed to load user stats' },
        { status: 500 },
      );
    }

    const triggerPoints =
      penalty.penalty_definitions?.[0]?.trigger_points || 0;
    const xpLossIfMissed =
      penalty.penalty_definitions?.[0]?.xp_loss_if_missed || 0;

    if (action === 'activate') {
      const currentPenaltyPoints = stats?.total_penalties_points || 0;
      if (currentPenaltyPoints < triggerPoints) {
        return NextResponse.json(
          {
            error:
              'Not enough penalty points to activate this penalty. Earn more penalty points first.',
          },
          { status: 400 },
        );
      }

      const { error: updatePenaltyError } = await supabase
        .from('user_penalties')
        .update({
          status: 'in-progress',
          updated_at: nowIso,
        })
        .eq('id', penalty.id)
        .eq('user_id', user.id);

      if (updatePenaltyError) {
        console.error(
          '[v0] Error activating user penalty:',
          updatePenaltyError,
        );
        return NextResponse.json(
          { error: 'Failed to activate penalty' },
          { status: 500 },
        );
      }

      // Mark definition as active while this penalty is running
      if (penalty.penalty_definitions?.[0]?.id) {
        await supabase
          .from('penalty_definitions')
          .update({ is_active: true, updated_at: nowIso })
          .eq('id', penalty.penalty_definitions[0].id)
          .eq('user_id', user.id);
      }

      return NextResponse.json({ success: true, status: 'in-progress' });
    }

    if (action === 'complete') {
      const dueAt = penalty.due_at ? new Date(penalty.due_at) : null;
      const beforeDue = dueAt ? now <= dueAt : true;

      let newStatus = 'done';
      let xpLostApplied = false;
      let xpLost = 0;

      let newCurrentXp = stats?.current_xp || 0;
      let newTotalXp = stats?.total_xp_earned || 0;
      let newPenaltyPoints = stats?.total_penalties_points || 0;

      if (beforeDue) {
        // Successful completion: subtract penalty points, no XP loss
        newPenaltyPoints = Math.max(0, newPenaltyPoints - triggerPoints);
      } else {
        // Missed deadline: apply XP loss, do not change penalty points
        newStatus = 'expired';
        xpLostApplied = true;
        xpLost = xpLossIfMissed;
        newCurrentXp = Math.max(0, newCurrentXp - xpLost);
        newTotalXp = Math.max(0, newTotalXp - xpLost);
      }

      const { error: updatePenaltyError } = await supabase
        .from('user_penalties')
        .update({
          status: newStatus,
          completed_at: nowIso,
          xp_lost_applied: xpLostApplied,
          xp_lost: xpLost,
          updated_at: nowIso,
        })
        .eq('id', penalty.id)
        .eq('user_id', user.id);

      if (updatePenaltyError) {
        console.error(
          '[v0] Error completing user penalty:',
          updatePenaltyError,
        );
        return NextResponse.json(
          { error: 'Failed to complete penalty' },
          { status: 500 },
        );
      }

      // Mark definition inactive again
      if (penalty.penalty_definitions?.[0]?.id) {
        await supabase
          .from('penalty_definitions')
          .update({ is_active: false, updated_at: nowIso })
          .eq('id', penalty.penalty_definitions[0].id)
          .eq('user_id', user.id);
      }

      // Update user_stats with new XP and penalty points
      if (stats) {
        await supabase
          .from('user_stats')
          .update({
            total_penalties_points: newPenaltyPoints,
            current_xp: newCurrentXp,
            total_xp_earned: newTotalXp,
            updated_at: nowIso,
          })
          .eq('user_id', user.id);
      }

      return NextResponse.json({
        success: true,
        status: newStatus,
        xpLost,
        penaltyPoints: newPenaltyPoints,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[v0] Error in penalties PATCH API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

