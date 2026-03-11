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

    // Fetch all categories for the user
    const { data: categories, error } = await supabase
      .from('quest_categories')
      .select('id, name, color, description, order_index, created_at, updated_at')
      .eq('user_id', user.id)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error in categories API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log('[v0] POST /api/categories called');
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log('[v0] User:', user?.id);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[v0] Request body:', body);
    const { name, color, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Insert the new category
    const { data: category, error } = await supabase
      .from('quest_categories')
      .insert([
        {
          user_id: user.id,
          name: name.trim(),
          color: color || '#3b82f6',
          description: description || null,
          order_index: 0,
        },
      ])
      .select()
      .single();

    console.log('[v0] Insert result:', { category, error });

    if (error) {
      console.error('[v0] Database error:', error);
      
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Category with this name already exists' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'Failed to create category' },
        { status: 500 }
      );
    }

    console.log('[v0] Category created successfully:', category);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('[v0] Error in categories API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
