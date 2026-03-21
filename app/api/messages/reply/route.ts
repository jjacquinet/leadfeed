import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { fetchMailbox, fetchMailboxes, fetchSenderProfiles, lookupContact, sendEmail, sendLinkedInMessage } from '@/lib/getsales';

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GETSALES_API_KEY) {
      return NextResponse.json({ error: 'GETSALES_API_KEY not configured' }, { status: 500 });
    }

    const body = await request.json();
    const {
      lead_id,
      sender_profile_uuid,
      sender_profile_name,
      sender_profile_identity,
      channel,
      content,
      subject,
      email_mode,
      thread_id,
      reply_to_email_uuid,
      attachments,
    } = body as {
      lead_id?: string;
      sender_profile_uuid?: string;
      sender_profile_name?: string;
      sender_profile_identity?: string;
      channel?: 'linkedin' | 'email';
      content?: string;
      subject?: string;
      email_mode?: 'reply' | 'new';
      thread_id?: string;
      reply_to_email_uuid?: string;
      attachments?: Array<{ uuid: string; name: string }>;
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
    if (!isUuid(leadUuid)) {
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
    let resolvedSenderProfileName = typeof sender_profile_name === 'string' ? sender_profile_name.trim() : '';
    let resolvedSenderProfileIdentity =
      typeof sender_profile_identity === 'string' ? sender_profile_identity.trim() : '';

    if (channel === 'linkedin') {
      const senderProfiles = await fetchSenderProfiles();
      const selectedProfile = senderProfiles.find((profile) => profile.uuid === sender_profile_uuid);
      if (!resolvedSenderProfileName && selectedProfile) {
        resolvedSenderProfileName =
          [selectedProfile.first_name, selectedProfile.last_name].filter(Boolean).join(' ').trim()
          || selectedProfile.label
          || '';
      }
      if (!resolvedSenderProfileIdentity && selectedProfile?.linkedin_account_uuid) {
        resolvedSenderProfileIdentity = selectedProfile.linkedin_account_uuid;
      }
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
      const resolvedMailboxUuid = mailbox?.uuid || selectedProfile?.mailbox_uuid || undefined;

      if (!resolvedFromEmail) {
        resolvedFromEmail = mailbox?.email?.trim() || '';
        if (!resolvedFromName) {
          resolvedFromName = mailbox?.sender_name?.trim() || '';
        }
      }

      if (!resolvedSenderProfileName) {
        resolvedSenderProfileName =
          resolvedFromName
          || [selectedProfile?.first_name, selectedProfile?.last_name].filter(Boolean).join(' ').trim()
          || selectedProfile?.label
          || '';
      }
      if (!resolvedSenderProfileIdentity) {
        resolvedSenderProfileIdentity = resolvedFromEmail || '';
      }

      if (!resolvedFromEmail) {
        return NextResponse.json({ error: 'Selected sender profile does not have a mailbox email' }, { status: 400 });
      }

      const emailSubject = subject?.trim() || 'Quick follow-up';
      const resolvedReplyToUuid =
        typeof reply_to_email_uuid === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reply_to_email_uuid)
          ? reply_to_email_uuid
          : undefined;
      const safeAttachments = Array.isArray(attachments)
        ? attachments.filter(
            (item) =>
              item &&
              typeof item.uuid === 'string' &&
              typeof item.name === 'string'
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
        mailbox_uuid: resolvedMailboxUuid,
        replied_to_uuid: resolvedReplyToUuid,
        attachments: safeAttachments,
      });
      const sentEmailUuid =
        typeof result?.uuid === 'string'
          ? result.uuid
          : typeof (result?.data as Record<string, unknown> | undefined)?.uuid === 'string'
            ? ((result?.data as Record<string, unknown>).uuid as string)
            : typeof (result?.emailDomain as Record<string, unknown> | undefined)?.uuid === 'string'
              ? ((result?.emailDomain as Record<string, unknown>).uuid as string)
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
        sender_profile_id: sender_profile_uuid,
        sender_profile_name: resolvedSenderProfileName || null,
        sender_profile_identity: resolvedSenderProfileIdentity || null,
        metadata: {
          ...(externalId ? { external_id: externalId } : {}),
          sender_profile_uuid,
          sender_profile_name: resolvedSenderProfileName || null,
          sender_profile_identity: resolvedSenderProfileIdentity || null,
          subject: subject?.trim() || null,
          email_mode: email_mode || null,
          thread_id: typeof thread_id === 'string' ? thread_id : null,
          reply_to_email_uuid:
            typeof reply_to_email_uuid === 'string' ? reply_to_email_uuid : null,
          email_uuid: externalId?.startsWith('gs_em_') ? externalId.replace(/^gs_em_/, '') : null,
          attachments:
            Array.isArray(attachments) && attachments.length > 0
              ? attachments.filter((a) => a?.uuid && a?.name).map((a) => ({
                  uuid: a.uuid,
                  name: a.name,
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
