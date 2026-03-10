import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { fetchMailbox, fetchMailboxes, fetchSenderProfiles, lookupContact, sendEmail, sendLinkedInMessage } from '@/lib/getsales';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GETSALES_API_KEY) {
      return NextResponse.json({ error: 'GETSALES_API_KEY not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { lead_id, sender_profile_uuid, channel, content, subject } = body as {
      lead_id?: string;
      sender_profile_uuid?: string;
      channel?: 'linkedin' | 'email';
      content?: string;
      subject?: string;
    };

    if (!lead_id || !sender_profile_uuid || !channel || !content?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: lead_id, sender_profile_uuid, channel, content' },
        { status: 400 }
      );
    }

    if (channel !== 'linkedin' && channel !== 'email') {
      return NextResponse.json({ error: 'Only linkedin and email are supported' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, getsales_uuid, first_name, last_name, linkedin_url, email')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    let leadUuid = lead.getsales_uuid as string | null;
    if (!leadUuid) {
      leadUuid = await lookupContact(lead.linkedin_url, lead.email);
      if (!leadUuid) {
        return NextResponse.json({ error: 'Could not resolve GetSales lead UUID' }, { status: 400 });
      }
      await supabase.from('leads').update({ getsales_uuid: leadUuid }).eq('id', lead_id);
    }

    const messageText = content.trim();
    const now = new Date().toISOString();

    let externalId: string | null = null;
    let messageContent = messageText;

    if (channel === 'linkedin') {
      const result = await sendLinkedInMessage({
        sender_profile_uuid,
        lead_uuid: leadUuid,
        text: messageText,
      });
      externalId = result?.uuid ? `gs_li_${result.uuid}` : null;
    } else {
      if (!lead.email) {
        return NextResponse.json({ error: 'Lead does not have an email address' }, { status: 400 });
      }

      let resolvedFromEmail = typeof body.from_email === 'string' ? body.from_email.trim() : '';
      let resolvedFromName = typeof body.from_name === 'string' ? body.from_name.trim() : '';

      if (!resolvedFromEmail) {
        const [senderProfiles, mailboxes] = await Promise.all([fetchSenderProfiles(), fetchMailboxes()]);
        const selectedProfile = senderProfiles.find((profile) => profile.uuid === sender_profile_uuid);
        const mailboxBySenderProfileUuid = new Map(mailboxes
          .filter((mailbox) => mailbox.sender_profile_uuid)
          .map((mailbox) => [mailbox.sender_profile_uuid as string, mailbox]));

        let mailbox = mailboxBySenderProfileUuid.get(sender_profile_uuid);
        if (!mailbox && selectedProfile?.mailbox_uuid) {
          mailbox = mailboxes.find((candidate) => candidate.uuid === selectedProfile.mailbox_uuid);
          if (!mailbox) {
            mailbox = await fetchMailbox(selectedProfile.mailbox_uuid) ?? undefined;
          }
        }

        resolvedFromEmail = mailbox?.email?.trim() || '';
        if (!resolvedFromName) {
          resolvedFromName = mailbox?.sender_name?.trim() || '';
        }
      }

      if (!resolvedFromEmail) {
        return NextResponse.json({ error: 'Selected sender profile does not have a mailbox email' }, { status: 400 });
      }

      const emailSubject = subject?.trim() || 'Quick follow-up';
      await sendEmail({
        sender_profile_uuid,
        lead_uuid: leadUuid,
        from_name: resolvedFromName || 'Outbounder',
        from_email: resolvedFromEmail,
        to_name: `${lead.first_name} ${lead.last_name}`.trim(),
        to_email: lead.email,
        subject: emailSubject,
        body: messageText,
      });
      messageContent = `**${emailSubject}**\n\n${messageText}`;
    }

    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        lead_id,
        channel,
        direction: 'outbound',
        content: messageContent,
        is_note: false,
        timestamp: now,
        external_id: externalId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[reply] Failed to store message:', insertError);
      return NextResponse.json({ error: 'Message sent but failed to save locally' }, { status: 500 });
    }

    await supabase
      .from('leads')
      .update({ last_activity: now, updated_at: now })
      .eq('id', lead_id);

    return NextResponse.json(newMessage);
  } catch (error) {
    console.error('[reply] Error:', error);
    return NextResponse.json({ error: 'Failed to send reply', message: String(error) }, { status: 500 });
  }
}
