import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { fetchMailbox, fetchMailboxes, fetchSenderProfiles, lookupContact, sendEmail, sendLinkedInMessage } from '@/lib/getsales';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GETSALES_API_KEY) {
      return NextResponse.json({ error: 'GETSALES_API_KEY not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { lead_id, sender_profile_uuid, channel, content, subject, email_mode, thread_id, reply_to_email_uuid, attachments } = body as {
      lead_id?: string;
      sender_profile_uuid?: string;
      channel?: 'linkedin' | 'email';
      content?: string;
      subject?: string;
      email_mode?: 'reply' | 'new';
      thread_id?: string;
      reply_to_email_uuid?: string;
      attachments?: Array<{
        filename: string;
        content_type?: string;
        content_base64: string;
        size?: number;
      }>;
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
      const safeAttachments = Array.isArray(attachments)
        ? attachments.filter(
            (item) =>
              item &&
              typeof item.filename === 'string' &&
              typeof item.content_base64 === 'string'
          )
        : [];
      const result = await sendEmail({
        sender_profile_uuid,
        lead_uuid: leadUuid,
        from_name: resolvedFromName || 'Outbounder',
        from_email: resolvedFromEmail,
        to_name: `${lead.first_name} ${lead.last_name}`.trim(),
        to_email: lead.email,
        subject: emailSubject,
        body: messageText,
        thread_id: typeof thread_id === 'string' ? thread_id : undefined,
        reply_to_email_uuid:
          typeof reply_to_email_uuid === 'string' ? reply_to_email_uuid : undefined,
        attachments: safeAttachments,
      });
      const sentEmailUuid =
        typeof result?.uuid === 'string'
          ? result.uuid
          : typeof result?.data?.uuid === 'string'
            ? result.data.uuid
            : null;
      if (sentEmailUuid) {
        externalId = `gs_em_${sentEmailUuid}`;
      }
      messageContent = `**${emailSubject}**\n\n${messageText}`;
    }

    const activityType =
      channel === 'linkedin'
        ? 'linkedin_sent'
        : 'email_sent';

    const { data: newActivity, error: insertError } = await supabase
      .from('activities')
      .insert({
        lead_id,
        type: activityType,
        channel,
        direction: 'outbound',
        content: messageContent,
        metadata: {
          ...(externalId ? { external_id: externalId } : {}),
          sender_profile_uuid,
          subject: subject?.trim() || null,
          email_mode: email_mode || null,
          thread_id: typeof thread_id === 'string' ? thread_id : null,
          reply_to_email_uuid:
            typeof reply_to_email_uuid === 'string' ? reply_to_email_uuid : null,
          email_uuid: externalId?.startsWith('gs_em_') ? externalId.replace(/^gs_em_/, '') : null,
          attachments:
            Array.isArray(attachments) && attachments.length > 0
              ? attachments.map((item) => ({
                  filename: item.filename,
                  content_type: item.content_type || null,
                  size: item.size || null,
                }))
              : null,
        },
        created_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[reply] Failed to store activity:', insertError);
      return NextResponse.json({ error: 'Message sent but failed to save locally' }, { status: 500 });
    }

    await supabase
      .from('leads')
      .update({ last_activity: now, last_activity_at: now, updated_at: now })
      .eq('id', lead_id);

    return NextResponse.json({
      id: newActivity.id,
      lead_id,
      channel,
      direction: 'outbound',
      content: messageContent,
      is_note: false,
      timestamp: newActivity.created_at,
      created_at: newActivity.created_at,
      external_id: externalId,
    });
  } catch (error) {
    console.error('[reply] Error:', error);
    return NextResponse.json({ error: 'Failed to send reply', message: String(error) }, { status: 500 });
  }
}
