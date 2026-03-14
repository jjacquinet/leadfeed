import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

function activityToLegacyMessage(activity: {
  id: string;
  lead_id: string;
  channel: 'email' | 'linkedin' | 'call' | 'text' | 'note';
  direction: 'inbound' | 'outbound' | 'internal';
  content: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}) {
  const externalId =
    activity.metadata && typeof activity.metadata.external_id === 'string'
      ? activity.metadata.external_id
      : null;
  return {
    id: activity.id,
    lead_id: activity.lead_id,
    channel: activity.channel === 'call' ? 'phone' : activity.channel,
    direction: activity.direction === 'internal' ? 'outbound' : activity.direction,
    content: activity.content,
    is_note: activity.channel === 'note',
    timestamp: activity.created_at,
    created_at: activity.created_at,
    external_id: externalId,
  };
}

function inferType(channel: string, direction: string, isNote: boolean) {
  if (isNote) return 'note';
  if (channel === 'email') return direction === 'inbound' ? 'email_received' : 'email_sent';
  if (channel === 'linkedin') return direction === 'inbound' ? 'linkedin_received' : 'linkedin_sent';
  if (channel === 'text') return direction === 'inbound' ? 'text_received' : 'text_sent';
  return 'call';
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

    return NextResponse.json((data ?? []).map(activityToLegacyMessage));
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    if (!body.lead_id || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: lead_id, content' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const resolvedChannel = body.is_note ? 'note' : body.channel === 'phone' ? 'call' : (body.channel || 'linkedin');
    const resolvedDirection = body.is_note ? 'internal' : (body.direction || 'outbound');
    const resolvedType = inferType(resolvedChannel, resolvedDirection, Boolean(body.is_note));

    const { data, error } = await supabase
      .from('activities')
      .insert({
        lead_id: body.lead_id,
        type: resolvedType,
        channel: resolvedChannel,
        direction: resolvedDirection,
        content: body.content,
        metadata: body.metadata || null,
        created_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
    }

    const leadUpdates: Record<string, unknown> = {
      last_activity: now,
      last_activity_at: now,
      updated_at: now,
    };
    if (resolvedDirection === 'inbound') {
      leadUpdates.last_inbound_at = now;
      leadUpdates.has_unread = true;
    }

    await supabase
      .from('leads')
      .update(leadUpdates)
      .eq('id', body.lead_id);

    return NextResponse.json(activityToLegacyMessage(data));
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
