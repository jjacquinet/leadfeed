import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { ActivityType } from '@/lib/types';

function inferChannel(type: ActivityType): 'email' | 'linkedin' | 'call' | 'text' | 'note' {
  if (type.startsWith('email')) return 'email';
  if (type.startsWith('linkedin')) return 'linkedin';
  if (type.startsWith('text')) return 'text';
  if (type === 'call') return 'call';
  return 'note';
}

function inferDirection(type: ActivityType): 'inbound' | 'outbound' | 'internal' {
  if (type.endsWith('_received')) return 'inbound';
  if (type === 'note') return 'internal';
  return 'outbound';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead_id parameter' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching activities:', error);
      return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const now = new Date().toISOString();
    const {
      lead_id,
      type,
      channel,
      direction,
      content,
      metadata,
      created_at,
    } = body as {
      lead_id?: string;
      type?: ActivityType;
      channel?: 'email' | 'linkedin' | 'call' | 'text' | 'note';
      direction?: 'inbound' | 'outbound' | 'internal';
      content?: string;
      metadata?: Record<string, unknown>;
      created_at?: string;
    };

    if (!lead_id || !type || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: lead_id, type, content' },
        { status: 400 }
      );
    }

    const resolvedChannel = channel ?? inferChannel(type);
    const resolvedDirection = direction ?? inferDirection(type);
    const createdAt = created_at ?? now;

    const { data, error } = await supabase
      .from('activities')
      .insert({
        lead_id,
        type,
        channel: resolvedChannel,
        direction: resolvedDirection,
        content,
        metadata: metadata ?? null,
        created_at: createdAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
    }

    const leadUpdate: Record<string, unknown> = {
      last_activity_at: createdAt,
      last_activity: createdAt,
      updated_at: now,
    };
    if (resolvedDirection === 'inbound') {
      leadUpdate.last_inbound_at = createdAt;
      leadUpdate.has_unread = true;
    }

    await supabase
      .from('leads')
      .update(leadUpdate)
      .eq('id', lead_id);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
