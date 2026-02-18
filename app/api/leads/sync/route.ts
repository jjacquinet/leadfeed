import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { fetchLinkedInMessages, fetchEmails, lookupContact } from '@/lib/getsales';

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

    // Fetch existing external_ids to avoid duplicates
    const { data: existingMessages } = await supabase
      .from('messages')
      .select('external_id')
      .eq('lead_id', leadId)
      .not('external_id', 'is', null);

    const existingExternalIds = new Set(
      (existingMessages || []).map((m) => m.external_id)
    );

    // Fetch LinkedIn messages and emails in parallel
    const [linkedinMessages, emails] = await Promise.all([
      fetchLinkedInMessages(getsalesUuid),
      fetchEmails(getsalesUuid),
    ]);

    console.log(`[sync] Lead ${lead.first_name} ${lead.last_name}: ${linkedinMessages.length} LinkedIn msgs, ${emails.length} emails`);

    const newMessages: {
      lead_id: string;
      channel: string;
      direction: string;
      content: string;
      is_note: boolean;
      timestamp: string;
      external_id: string;
    }[] = [];

    // Process LinkedIn messages
    for (const msg of linkedinMessages) {
      const externalId = `gs_li_${msg.uuid}`;
      if (existingExternalIds.has(externalId)) continue;
      if (!msg.text || msg.text.trim() === '') continue;

      newMessages.push({
        lead_id: leadId,
        channel: 'linkedin',
        direction: msg.type === 'inbox' ? 'inbound' : 'outbound',
        content: msg.text,
        is_note: false,
        timestamp: msg.sent_at || new Date().toISOString(),
        external_id: externalId,
      });
    }

    // Process emails
    for (const email of emails) {
      const externalId = `gs_em_${email.uuid}`;
      if (existingExternalIds.has(externalId)) continue;

      // Strip HTML tags from email body if present
      let body = email.body || '';
      if (body.includes('<') && body.includes('>')) {
        body = body
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      const content = email.subject
        ? `**${email.subject}**\n\n${body}`
        : body;
      if (!content.trim()) continue;

      console.log(`[sync] Email "${email.subject}" body length: ${body.length}, preview: "${body.substring(0, 100)}"`);

      newMessages.push({
        lead_id: leadId,
        channel: 'email',
        direction: email.type === 'inbox' ? 'inbound' : 'outbound',
        content,
        is_note: false,
        timestamp: email.sent_at || new Date().toISOString(),
        external_id: externalId,
      });
    }

    // Insert new messages
    if (newMessages.length > 0) {
      const { error: insertError } = await supabase.from('messages').insert(newMessages);
      if (insertError) {
        console.error('[sync] Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to insert messages' }, { status: 500 });
      }

      // Update lead's last_activity
      const latestTimestamp = newMessages
        .map((m) => new Date(m.timestamp).getTime())
        .reduce((a, b) => Math.max(a, b), 0);

      await supabase
        .from('leads')
        .update({
          last_activity: new Date(latestTimestamp).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    }

    console.log(`[sync] Synced ${newMessages.length} new messages for lead ${leadId}`);

    return NextResponse.json({
      synced: newMessages.length,
      linkedin: linkedinMessages.length,
      emails: emails.length,
    });
  } catch (error) {
    console.error('[sync] Error:', error);
    return NextResponse.json({ error: 'Sync failed', message: String(error) }, { status: 500 });
  }
}
