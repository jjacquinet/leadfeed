import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { fetchLinkedInMessages, fetchEmails } from '@/lib/getsales';

/**
 * Sync conversations from GetSales.io for a specific lead.
 * POST /api/leads/sync?lead_id=<uuid>
 *
 * Fetches LinkedIn messages and emails from GetSales.io API,
 * deduplicates against existing messages using external_id,
 * and inserts any new ones.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get the lead to find its GetSales UUID
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, getsales_uuid, first_name, last_name')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!lead.getsales_uuid) {
      return NextResponse.json({
        synced: 0,
        message: 'No GetSales.io UUID for this lead — conversations will sync once a webhook with a UUID is received',
      });
    }

    // Check if GetSales API key is configured
    if (!process.env.GETSALES_API_KEY) {
      return NextResponse.json({
        synced: 0,
        message: 'GETSALES_API_KEY not configured',
      });
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
      fetchLinkedInMessages(lead.getsales_uuid),
      fetchEmails(lead.getsales_uuid),
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

      const content = email.subject
        ? `**${email.subject}**\n\n${email.body || ''}`
        : email.body || '';
      if (!content.trim()) continue;

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
