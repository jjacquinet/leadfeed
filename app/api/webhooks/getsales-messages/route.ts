import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { ActivityType } from '@/lib/types';

type EventMapping = {
  type: ActivityType;
  channel: 'email' | 'linkedin';
  direction: 'inbound' | 'outbound';
  fallbackContent: string;
};

const EVENT_MAP: Record<string, EventMapping> = {
  email_sent: {
    type: 'email_sent',
    channel: 'email',
    direction: 'outbound',
    fallbackContent: 'Email sent',
  },
  email_received: {
    type: 'email_received',
    channel: 'email',
    direction: 'inbound',
    fallbackContent: 'Email received',
  },
  connection_request_sent: {
    type: 'connection_request_sent',
    channel: 'linkedin',
    direction: 'outbound',
    fallbackContent: 'Connection request sent',
  },
  connection_request_accepted: {
    type: 'connection_request_accepted',
    channel: 'linkedin',
    direction: 'inbound',
    fallbackContent: 'Connection request accepted',
  },
  linkedin_message_sent: {
    type: 'linkedin_sent',
    channel: 'linkedin',
    direction: 'outbound',
    fallbackContent: 'LinkedIn message sent',
  },
  linkedin_message_received: {
    type: 'linkedin_received',
    channel: 'linkedin',
    direction: 'inbound',
    fallbackContent: 'LinkedIn message received',
  },
};

function deepGet(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const root = obj as Record<string, unknown>;

  for (const key of keys) {
    const value = root[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const wrappers = ['data', 'payload', 'contact', 'lead', 'person', 'record', 'sender_profile', 'senderProfile', 'account', 'mailbox'];
  for (const wrapper of wrappers) {
    const nested = root[wrapper];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue;
    const found = deepGet(nested, ...keys);
    if (found) return found;
  }

  return null;
}

function parseTimestamp(input: string | null): string {
  if (!input) return new Date().toISOString();
  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function subtractSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() - seconds * 1000).toISOString();
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

function parseSenderContext(payload: unknown) {
  const senderProfileId = deepGet(
    payload,
    'sender_profile_uuid',
    'sender_profile_id',
    'senderProfileUuid',
    'senderProfileId',
    'profile_uuid'
  );
  const senderProfileName = deepGet(
    payload,
    'sender_profile_name',
    'sender_name',
    'from_name',
    'profile_name',
    'senderProfileName'
  );
  const senderProfileIdentity = deepGet(
    payload,
    'sender_profile_identity',
    'from_email',
    'sender_email',
    'email_from',
    'linkedin_identity',
    'linkedin_handle',
    'linkedin_username',
    'public_identifier'
  );

  return {
    senderProfileId,
    senderProfileName,
    senderProfileIdentity,
  };
}

async function parseBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return request.json();

  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch {
    const params = new URLSearchParams(text);
    const data: Record<string, string> = {};
    params.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const headerKey = request.headers.get('x-webhook-key') || request.headers.get('x-api-key');
    const queryKey = searchParams.get('key');
    const providedKey = headerKey || queryKey;
    const expectedKey = process.env.GETSALES_MESSAGES_WEBHOOK_KEY || process.env.WEBHOOK_API_KEY;
    if (expectedKey && providedKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized webhook key' }, { status: 401 });
    }

    const payload = await parseBody(request);
    const eventName = deepGet(payload, 'event_type', 'event', 'event_name', 'type');
    if (!eventName || !EVENT_MAP[eventName]) {
      return NextResponse.json({ ignored: true, reason: 'unsupported_event' });
    }

    const mapping = EVENT_MAP[eventName];
    const email = deepGet(payload, 'email', 'email_address', 'work_email');
    const linkedinUrl = deepGet(payload, 'linkedin_url', 'linkedinUrl', 'linkedin_profile_url', 'profile_url');
    const content =
      deepGet(payload, 'content', 'message', 'body', 'text', 'message_text') ||
      mapping.fallbackContent;
    const { senderProfileId, senderProfileName, senderProfileIdentity } = parseSenderContext(payload);
    const timestamp = parseTimestamp(
      deepGet(payload, 'timestamp', 'created_at', 'sent_at', 'occurred_at', 'event_time')
    );

    const supabase = getServiceClient();

    let lead: { id: string } | null = null;
    if (email) {
      const { data } = await supabase
        .from('leads')
        .select('id')
        .eq('email', email)
        .limit(1)
        .maybeSingle();
      lead = data;
    }
    if (!lead && linkedinUrl) {
      const { data } = await supabase
        .from('leads')
        .select('id')
        .eq('linkedin_url', linkedinUrl)
        .limit(1)
        .maybeSingle();
      lead = data;
    }

    if (!lead) {
      return NextResponse.json({ ignored: true, reason: 'lead_not_found' });
    }

    const windowStart = subtractSeconds(timestamp, 60);
    const windowEnd = addSeconds(timestamp, 60);
    const { data: duplicate } = await supabase
      .from('activities')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('type', mapping.type)
      .eq('content', content)
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .limit(1)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json({ ignored: true, reason: 'duplicate' });
    }

    const metadata: Record<string, unknown> = {
      source: 'getsales_messages_webhook',
      event_type: eventName,
      sender_profile_uuid: senderProfileId,
      sender_profile_name: senderProfileName,
      sender_profile_identity: senderProfileIdentity,
    };
    const externalId = deepGet(payload, 'uuid', 'event_id', 'message_uuid', 'id');
    if (externalId) metadata.external_id = externalId;

    const { error: activityError } = await supabase.from('activities').insert({
      lead_id: lead.id,
      type: mapping.type,
      channel: mapping.channel,
      direction: mapping.direction,
      content,
      sender_profile_id: senderProfileId,
      sender_profile_name: senderProfileName,
      sender_profile_identity: senderProfileIdentity,
      created_at: timestamp,
      metadata,
    });

    if (activityError) {
      console.error('[getsales-messages-webhook] activity insert error', activityError);
      return NextResponse.json({ error: 'Failed to insert activity' }, { status: 500 });
    }

    const leadUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_activity: timestamp,
      last_activity_at: timestamp,
    };
    if (mapping.direction === 'inbound') {
      leadUpdates.has_unread = true;
      leadUpdates.last_inbound_at = timestamp;
    }

    const { error: leadUpdateError } = await supabase
      .from('leads')
      .update(leadUpdates)
      .eq('id', lead.id);

    if (leadUpdateError) {
      console.error('[getsales-messages-webhook] lead update error', leadUpdateError);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead_id: lead.id, event_type: eventName });
  } catch (error) {
    console.error('[getsales-messages-webhook] unhandled error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
