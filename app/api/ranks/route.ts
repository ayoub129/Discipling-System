'use server';

import { createClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch rank definitions with progression rules
    const { data: ranks, error: ranksError } = await supabase
      .from('rank_definitions')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true });

    if (ranksError) throw ranksError;

    // Fetch rank progression rules
    const { data: progressionRules, error: rulesError } = await supabase
      .from('rank_progression_rules')
      .select(`
        id,
        from_rank_id,
        to_rank_id,
        required_level,
        rank_definitions!from_rank_id(name, code),
        to_rank:rank_definitions!to_rank_id(name, code)
      `)
      .eq('user_id', user.id);

    if (rulesError) throw rulesError;

    return NextResponse.json({
      ranks: ranks || [],
      progressionRules: progressionRules || [],
    });
  } catch (error) {
    console.error('Error fetching ranks:', error);
    return NextResponse.json({ error: 'Failed to fetch ranks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (body.type === 'create-rank') {
      const { data, error } = await supabase
        .from('rank_definitions')
        .insert({
          user_id: user.id,
          name: body.name,
          code: body.code,
          color: body.color,
          display_order: body.display_order,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    if (body.type === 'update-rank') {
      const { data, error } = await supabase
        .from('rank_definitions')
        .update({
          name: body.name,
          color: body.color,
        })
        .eq('id', body.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    if (body.type === 'delete-rank') {
      const { error } = await supabase
        .from('rank_definitions')
        .delete()
        .eq('id', body.id)
        .eq('user_id', user.id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.type === 'create-progression') {
      const { data, error } = await supabase
        .from('rank_progression_rules')
        .insert({
          user_id: user.id,
          from_rank_id: body.from_rank_id,
          to_rank_id: body.to_rank_id,
          required_level: body.required_level,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error managing ranks:', error);
    return NextResponse.json({ error: 'Failed to manage ranks' }, { status: 500 });
  }
}
