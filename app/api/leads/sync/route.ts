import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { ensureProspect, fetchLinkedInConnectionEvents, fetchLinkedInMessages, fetchEmails } from '@/lib/getsales';
import { cleanEmailReplyContent } from '@/lib/utils';

/**
 * Sync conversations from GetSales.io for a specific lead.
 * POST /api/leads/sync?lead_id=<uuid>
 *
 * If no GetSales UUID is stored, attempts to look it up via LinkedIn URL or email.
 * Then fetches LinkedIn messages and emails, deduplicates, and inserts new ones.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');
    const syncOnlyProspect = searchParams.get('sync_only_prospect') === 'true';

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });
    }

    // Check if GetSales API key is configured
    if (!process.env.GETSALES_API_KEY) {
      return NextResponse.json({
        synced: 0,
        message: 'GETSALES_API_KEY not configured',
      });
    }

    const supabase = getSupabase();

    // Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, getsales_uuid, getsales_prospect_id, first_name, last_name, title, company, linkedin_url, email')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    let getsalesUuid = lead.getsales_prospect_id || lead.getsales_uuid;
    if (!getsalesUuid) {
      console.log(`[sync] No GetSales prospect id for ${lead.first_name} ${lead.last_name}, resolving...`);
      getsalesUuid = await ensureProspect({
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        linkedin_url: lead.linkedin_url,
        title: lead.title,
        company: lead.company,
      });

      if (getsalesUuid) {
        console.log(`[sync] Resolved prospect id: ${getsalesUuid}`);
        await supabase
          .from('leads')
          .update({ getsales_uuid: getsalesUuid, getsales_prospect_id: getsalesUuid })
          .eq('id', leadId);
      } else {
        console.log(`[sync] Could not resolve prospect id for ${lead.first_name} ${lead.last_name}`);
        return NextResponse.json({
          synced: 0,
          prospect_synced: false,
          message: process.env.GETSALES_UPSERT_LIST_UUID
            ? 'Could not find or create this contact in GetSales by LinkedIn URL or email'
            : 'Could not find contact, and GETSALES_UPSERT_LIST_UUID is missing for GetSales upsert',
        });
      }
    } else if (!lead.getsales_prospect_id) {
      await supabase
        .from('leads')
        .update({ getsales_prospect_id: getsalesUuid, updated_at: new Date().toISOString() })
        .eq('id', leadId);
    }

    if (syncOnlyProspect) {
      return NextResponse.json({
        synced: 0,
        prospect_synced: true,
        getsales_prospect_id: getsalesUuid,
      });
    }

    const { data: existingActivities } = await supabase
      .from('activities')
      .select('id, type, content, created_at, metadata')
      .eq('lead_id', leadId);

    const existingExternalIds = new Set<string>();
    for (const activity of existingActivities || []) {
      const externalId = activity?.metadata?.external_id;
      if (typeof externalId === 'string' && externalId) {
        existingExternalIds.add(externalId);
      }
    }

    const existingByTimeContent = (existingActivities || []).map((activity) => ({
      type: typeof activity.type === 'string' ? activity.type : '',
      content: typeof activity.content === 'string' ? activity.content : '',
      timestamp: activity.created_at ? new Date(activity.created_at).getTime() : 0,
    }));
    const isDuplicateWithinWindow = (type: string, content: string, isoTimestamp: string): boolean => {
      const target = new Date(isoTimestamp).getTime();
      if (!Number.isFinite(target)) return false;
      return existingByTimeContent.some((existing) => {
        if (existing.type !== type) return false;
        if ((existing.content || '').trim() !== (content || '').trim()) return false;
        return Math.abs(existing.timestamp - target) <= 60000;
      });
    };

    // Fetch LinkedIn messages, emails, and connection events in parallel
    const [linkedinMessages, emails, connectionEvents] = await Promise.all([
      fetchLinkedInMessages(getsalesUuid),
      fetchEmails(getsalesUuid),
      fetchLinkedInConnectionEvents(getsalesUuid),
    ]);

    console.log(
      `[sync] Lead ${lead.first_name} ${lead.last_name}: ${linkedinMessages.length} LinkedIn msgs, ${emails.length} emails, ${connectionEvents.length} connection events`
    );

    const newActivities: {
      lead_id: string;
      type: string;
      channel: string;
      direction: string;
      content: string;
      sender_profile_id?: string | null;
      sender_profile_name?: string | null;
      sender_profile_identity?: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    }[] = [];

    // Process LinkedIn messages
    for (const msg of linkedinMessages) {
      const externalId = `gs_li_${msg.uuid}`;
      if (existingExternalIds.has(externalId)) continue;
      if (!msg.text || msg.text.trim() === '') continue;
      const type = msg.type === 'inbox' ? 'linkedin_received' : 'linkedin_sent';
      const createdAt = msg.sent_at || new Date().toISOString();
      if (isDuplicateWithinWindow(type, msg.text, createdAt)) continue;

      newActivities.push({
        lead_id: leadId,
        type,
        channel: 'linkedin',
        direction: msg.type === 'inbox' ? 'inbound' : 'outbound',
        content: msg.text,
        sender_profile_id: msg.sender_profile_uuid || null,
        sender_profile_name: msg.sender_profile_name || null,
        sender_profile_identity: msg.sender_profile_identity || msg.linkedin_identity || null,
        metadata: {
          external_id: externalId,
          source: 'getsales_sync',
          sender_profile_uuid: msg.sender_profile_uuid || null,
          sender_profile_name: msg.sender_profile_name || null,
          sender_profile_identity: msg.sender_profile_identity || msg.linkedin_identity || null,
        },
        created_at: createdAt,
      });
      existingByTimeContent.push({
        type,
        content: msg.text,
        timestamp: new Date(createdAt).getTime(),
      });
    }

    for (const event of connectionEvents) {
      const eventType =
        event.connection_event ||
        (event.type === 'inbox' ? 'connection_request_accepted' : 'connection_request_sent');
      const content = event.text || (eventType === 'connection_request_accepted'
        ? 'Connection request accepted'
        : 'Connection request sent');
      const createdAt = event.sent_at || new Date().toISOString();
      const externalId = `gs_conn_${event.uuid}`;
      if (existingExternalIds.has(externalId)) continue;
      if (isDuplicateWithinWindow(eventType, content, createdAt)) continue;

      newActivities.push({
        lead_id: leadId,
        type: eventType,
        channel: 'linkedin',
        direction: eventType === 'connection_request_accepted' ? 'inbound' : 'outbound',
        content,
        sender_profile_id: event.sender_profile_uuid || null,
        sender_profile_name: event.sender_profile_name || null,
        sender_profile_identity: event.sender_profile_identity || event.linkedin_identity || null,
        metadata: {
          external_id: externalId,
          source: 'getsales_sync',
          sender_profile_uuid: event.sender_profile_uuid || null,
          sender_profile_name: event.sender_profile_name || null,
          sender_profile_identity: event.sender_profile_identity || event.linkedin_identity || null,
          connection_event: eventType,
        },
        created_at: createdAt,
      });
      existingByTimeContent.push({
        type: eventType,
        content,
        timestamp: new Date(createdAt).getTime(),
      });
    }

    // Process emails
    for (const email of emails) {
      const externalId = `gs_em_${email.uuid}`;
      if (existingExternalIds.has(externalId)) continue;

      const rawBody = email.body || '';
      const cleaned = cleanEmailReplyContent(rawBody);
      const body = cleaned.cleanedContent;

      const content = email.subject
        ? `**${email.subject}**\n\n${body}`
        : body;
      if (!content.trim()) continue;
      const type = email.type === 'inbox' ? 'email_received' : 'email_sent';
      const createdAt = email.sent_at || new Date().toISOString();
      if (isDuplicateWithinWindow(type, content, createdAt)) continue;

      console.log(`[sync] Email "${email.subject}" body length: ${body.length}, preview: "${body.substring(0, 100)}"`);

      newActivities.push({
        lead_id: leadId,
        type,
        channel: 'email',
        direction: email.type === 'inbox' ? 'inbound' : 'outbound',
        content,
        sender_profile_id:
          typeof email.sender_profile_uuid === 'string' ? email.sender_profile_uuid : null,
        sender_profile_name:
          typeof (email as Record<string, unknown>).sender_profile_name === 'string'
            ? ((email as Record<string, unknown>).sender_profile_name as string)
            : typeof (email as Record<string, unknown>).from_name === 'string'
              ? ((email as Record<string, unknown>).from_name as string)
              : null,
        sender_profile_identity:
          typeof (email as Record<string, unknown>).from_email === 'string'
            ? ((email as Record<string, unknown>).from_email as string)
            : null,
        metadata: {
          external_id: externalId,
          source: 'getsales_sync',
          raw_content: rawBody,
          email_cleaned: cleaned.wasCleaned,
          subject: email.subject || null,
          sender_profile_uuid:
            typeof email.sender_profile_uuid === 'string' ? email.sender_profile_uuid : null,
          sender_profile_name:
            typeof (email as Record<string, unknown>).sender_profile_name === 'string'
              ? ((email as Record<string, unknown>).sender_profile_name as string)
              : typeof (email as Record<string, unknown>).from_name === 'string'
                ? ((email as Record<string, unknown>).from_name as string)
                : null,
          sender_profile_identity:
            typeof (email as Record<string, unknown>).from_email === 'string'
              ? ((email as Record<string, unknown>).from_email as string)
              : null,
          thread_id:
            (typeof email.thread_id === 'string' && email.thread_id) ||
            (typeof email.thread_uuid === 'string' && email.thread_uuid) ||
            (typeof email.email_thread_uuid === 'string' && email.email_thread_uuid) ||
            null,
          email_uuid: email.uuid || null,
        },
        created_at: createdAt,
      });
      existingByTimeContent.push({
        type,
        content,
        timestamp: new Date(createdAt).getTime(),
      });
    }

    // Insert new activities
    if (newActivities.length > 0) {
      const { error: insertError } = await supabase.from('activities').insert(newActivities);
      if (insertError) {
        console.error('[sync] Insert activities error:', insertError);
        return NextResponse.json({ error: 'Failed to insert activities' }, { status: 500 });
      }

      const latestTimestamp = newActivities
        .map((m) => new Date(m.created_at).getTime())
        .reduce((a, b) => Math.max(a, b), 0);
      const hasInbound = newActivities.some((a) => a.direction === 'inbound');

      await supabase
        .from('leads')
        .update({
          last_activity: new Date(latestTimestamp).toISOString(),
          last_activity_at: new Date(latestTimestamp).toISOString(),
          ...(hasInbound ? {
            has_unread: true,
            last_inbound_at: new Date(latestTimestamp).toISOString(),
          } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    }

    console.log(`[sync] Synced ${newActivities.length} new activities for lead ${leadId}`);

    return NextResponse.json({
      synced: newActivities.length,
      updated: 0,
      prospect_synced: true,
      getsales_prospect_id: getsalesUuid,
      linkedin: linkedinMessages.length,
      connections: connectionEvents.length,
      emails: emails.length,
    });
  } catch (error) {
    console.error('[sync] Error:', error);
    return NextResponse.json({ error: 'Sync failed', message: String(error) }, { status: 500 });
  }
}
