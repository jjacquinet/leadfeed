import { NextRequest, NextResponse } from 'next/server';
import { fetchLinkedInAccount, fetchMailbox, fetchMailboxes, fetchSenderProfiles } from '@/lib/getsales';

const LINKEDIN_CONNECTED_SENDER_PROFILE_UUIDS = new Set([
  '06f84941-fd7b-4685-8610-3b533d9df603',
  '1dc5c804-3c6b-4f93-a591-f7b877b7f590',
  'fb871e83-4a03-427f-a001-115c304cdd40',
  'e41d23df-9606-4e92-8b56-90e3c1d1b124',
  'fa7312ff-fb9a-448b-b492-35a7d2fc4749',
  '55243059-6f28-492f-9a51-4741ff92f7b2',
  '34fd3858-9456-423c-a487-626267630503',
  'bca6e1a4-0d52-4144-83c6-d7bad52efc91',
  '9ba5beeb-c428-480c-877b-6cc4cdd9aab8',
  'd0cea563-c804-40fb-88a7-a6b9ca4faa6a',
  '0c9784ad-1e07-4879-9ac2-160cda154f4d',
]);

function parseLinkedInIdentity(account: Record<string, unknown> | null): string | null {
  if (!account) return null;
  const direct =
    (typeof account.public_identifier === 'string' && account.public_identifier.trim()) ||
    (typeof account.username === 'string' && account.username.trim()) ||
    (typeof account.name === 'string' && account.name.trim()) ||
    (typeof account.full_name === 'string' && account.full_name.trim()) ||
    null;
  if (direct) return direct;

  const url =
    (typeof account.profile_url === 'string' && account.profile_url.trim()) ||
    (typeof account.linkedin_url === 'string' && account.linkedin_url.trim()) ||
    null;
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1] || null;
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.GETSALES_API_KEY) {
      return NextResponse.json({ error: 'GETSALES_API_KEY not configured' }, { status: 500 });
    }
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel');

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

    const activeProfiles = senderProfiles
      .filter((profile) => profile.status !== 'disabled')
      .filter((profile) =>
        channel === 'linkedin'
          ? LINKEDIN_CONNECTED_SENDER_PROFILE_UUIDS.has(profile.uuid)
          : true
      );

    const linkedInAccountsByUuid = new Map<string, Record<string, unknown> | null>();
    if (channel === 'linkedin') {
      await Promise.all(
        activeProfiles.map(async (profile) => {
          if (!profile.linkedin_account_uuid) {
            linkedInAccountsByUuid.set(profile.uuid, null);
            return;
          }
          const account = await fetchLinkedInAccount(profile.linkedin_account_uuid);
          linkedInAccountsByUuid.set(profile.uuid, account as Record<string, unknown> | null);
        })
      );
    }

    const data = activeProfiles.map((profile) => {
        const mailbox = mailboxBySenderProfileUuid.get(profile.uuid)
          || (profile.mailbox_uuid ? mailboxByUuid.get(profile.mailbox_uuid) : undefined);
        const linkedInAccount = linkedInAccountsByUuid.get(profile.uuid) || null;
        return {
          uuid: profile.uuid,
          first_name: profile.first_name,
          last_name: profile.last_name,
          label: profile.label,
          status: profile.status,
          mailbox_uuid: profile.mailbox_uuid,
          from_name: mailbox?.sender_name ?? null,
          from_email: mailbox?.email ?? null,
          linkedin_account_uuid: profile.linkedin_account_uuid,
          linkedin_identity: parseLinkedInIdentity(linkedInAccount),
          linkedin_profile_url:
            linkedInAccount && typeof linkedInAccount.profile_url === 'string'
              ? linkedInAccount.profile_url
              : linkedInAccount && typeof linkedInAccount.linkedin_url === 'string'
                ? linkedInAccount.linkedin_url
                : null,
        };
      });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[getsales] sender profiles route error:', error);
    return NextResponse.json({ error: 'Failed to load sender profiles' }, { status: 500 });
  }
}
