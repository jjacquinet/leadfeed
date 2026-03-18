import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { fetchLinkedInMessages, fetchEmails, lookupContact } from '@/lib/getsales';
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
      .select('id, getsales_uuid, first_name, last_name, linkedin_url, email')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // If no GetSales UUID, try to look it up via LinkedIn URL or email
    let getsalesUuid = lead.getsales_uuid;
    if (!getsalesUuid) {
      console.log(`[sync] No UUID for ${lead.first_name} ${lead.last_name}, looking up...`);
      getsalesUuid = await lookupContact(lead.linkedin_url, lead.email);

      if (getsalesUuid) {
        console.log(`[sync] Found UUID: ${getsalesUuid}`);
        await supabase
          .from('leads')
          .update({ getsales_uuid: getsalesUuid })
          .eq('id', leadId);
      } else {
        console.log(`[sync] Could not find UUID for ${lead.first_name} ${lead.last_name}`);
        return NextResponse.json({
          synced: 0,
          message: 'Could not find this contact in GetSales.io by LinkedIn URL or email',
        });
      }
    }

    const { data: existingActivities } = await supabase
      .from('activities')
      .select('id, metadata')
      .eq('lead_id', leadId);

    const existingExternalIds = new Set<string>();
    for (const activity of existingActivities || []) {
      const externalId = activity?.metadata?.external_id;
      if (typeof externalId === 'string' && externalId) {
        existingExternalIds.add(externalId);
      }
    }

    // Fetch LinkedIn messages and emails in parallel
    const [linkedinMessages, emails] = await Promise.all([
      fetchLinkedInMessages(getsalesUuid),
      fetchEmails(getsalesUuid),
    ]);

    console.log(`[sync] Lead ${lead.first_name} ${lead.last_name}: ${linkedinMessages.length} LinkedIn msgs, ${emails.length} emails`);

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

      newActivities.push({
        lead_id: leadId,
        type: msg.type === 'inbox' ? 'linkedin_received' : 'linkedin_sent',
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
        created_at: msg.sent_at || new Date().toISOString(),
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

      console.log(`[sync] Email "${email.subject}" body length: ${body.length}, preview: "${body.substring(0, 100)}"`);

      newActivities.push({
        lead_id: leadId,
        type: email.type === 'inbox' ? 'email_received' : 'email_sent',
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
        created_at: email.sent_at || new Date().toISOString(),
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
      linkedin: linkedinMessages.length,
      emails: emails.length,
    });
  } catch (error) {
    console.error('[sync] Error:', error);
    return NextResponse.json({ error: 'Sync failed', message: String(error) }, { status: 500 });
  }
}
