import { NextResponse } from 'next/server';
import { fetchMailbox, fetchMailboxes, fetchSenderProfiles } from '@/lib/getsales';

export async function GET() {
  try {
    if (!process.env.GETSALES_API_KEY) {
      return NextResponse.json({ error: 'GETSALES_API_KEY not configured' }, { status: 500 });
    }

    const senderProfiles = await fetchSenderProfiles();
    const mailboxes = await fetchMailboxes();
    const mailboxBySenderProfileUuid = new Map<string, { sender_name: string | null; email: string | null }>();
    const mailboxByUuid = new Map<string, { sender_name: string | null; email: string | null }>();
    for (const mailbox of mailboxes) {
      if (mailbox.sender_profile_uuid) {
        mailboxBySenderProfileUuid.set(mailbox.sender_profile_uuid, {
          sender_name: mailbox.sender_name ?? null,
          email: mailbox.email ?? null,
        });
      }
      mailboxByUuid.set(mailbox.uuid, {
        sender_name: mailbox.sender_name ?? null,
        email: mailbox.email ?? null,
      });
    }

    await Promise.all(
      senderProfiles.map(async (profile) => {
        if (!profile.mailbox_uuid || mailboxByUuid.has(profile.mailbox_uuid)) return;
        const mailbox = await fetchMailbox(profile.mailbox_uuid);
        if (mailbox) {
          mailboxByUuid.set(profile.mailbox_uuid, {
            sender_name: mailbox.sender_name ?? null,
            email: mailbox.email ?? null,
          });
        }
      })
    );

    const data = senderProfiles
      .filter((profile) => profile.status !== 'disabled')
      .map((profile) => {
        const mailbox = mailboxBySenderProfileUuid.get(profile.uuid)
          || (profile.mailbox_uuid ? mailboxByUuid.get(profile.mailbox_uuid) : undefined);
        return {
          uuid: profile.uuid,
          first_name: profile.first_name,
          last_name: profile.last_name,
          label: profile.label,
          status: profile.status,
          mailbox_uuid: profile.mailbox_uuid,
          from_name: mailbox?.sender_name ?? null,
          from_email: mailbox?.email ?? null,
        };
      });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[getsales] sender profiles route error:', error);
    return NextResponse.json({ error: 'Failed to load sender profiles' }, { status: 500 });
  }
}
