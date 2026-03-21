/* eslint-disable @typescript-eslint/no-explicit-any */

const GETSALES_BASE_URL = process.env.GETSALES_BASE_URL || 'https://amazing.getsales.io';

function getHeaders(): HeadersInit {
  const apiKey = process.env.GETSALES_API_KEY;
  if (!apiKey) throw new Error('GETSALES_API_KEY not configured');
  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (process.env.GETSALES_TEAM_ID) {
    headers['Team-ID'] = process.env.GETSALES_TEAM_ID;
  }
  return headers;
}

export interface GetSalesLinkedInMessage {
  uuid: string;
  text: string;
  type: 'outbox' | 'inbox';
  sent_at: string | null;
  read_at: string | null;
  status: string;
  lead_uuid: string;
  sender_profile_uuid?: string | null;
  sender_profile_name?: string | null;
  sender_profile_identity?: string | null;
  linkedin_identity?: string | null;
  connection_event?: 'connection_request_sent' | 'connection_request_accepted' | null;
}

export interface GetSalesEmail {
  uuid: string;
  subject: string;
  body: string;
  email_body_uuid?: string | null;
  type: 'outbox' | 'inbox';
  sent_at: string | null;
  status: string;
  lead_uuid: string;
  // Possible alternative body fields from API
  text?: string;
  content?: string;
  html_body?: string;
  body_html?: string;
  body_text?: string;
  message?: string;
  email_body?: { body?: string; content?: string } | null;
  emailBody?: { body?: string; content?: string } | null;
  email_body_domain?: { body?: string; content?: string } | null;
  emailBodyDomain?: { body?: string; content?: string } | null;
  sender_profile_uuid?: string | null;
  sender_profile_name?: string | null;
  from_name?: string | null;
  from_email?: string | null;
  [key: string]: any;
}

export interface GetSalesSenderProfile {
  uuid: string;
  first_name: string | null;
  last_name: string | null;
  label: string | null;
  status: string | null;
  mailbox_uuid: string | null;
  linkedin_account_uuid: string | null;
}

export interface GetSalesMailbox {
  uuid: string;
  sender_profile_uuid?: string | null;
  sender_name: string | null;
  email: string | null;
  status?: string | null;
}

export interface GetSalesLinkedInAccount {
  uuid: string;
  name?: string | null;
  full_name?: string | null;
  username?: string | null;
  public_identifier?: string | null;
  profile_url?: string | null;
  linkedin_url?: string | null;
  [key: string]: any;
}

export type EnsureProspectInput = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  title?: string | null;
  company?: string | null;
};

export type SyncWorkEmailInput = {
  work_email: string;
  getsales_prospect_id?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  previous_email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
};

type ProspectLikeResponse = {
  uuid?: string;
  id?: string;
  data?: {
    uuid?: string;
    id?: string;
  };
  [key: string]: any;
};

function extractUuid(payload: ProspectLikeResponse | null | undefined): string | null {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.uuid === 'string' && payload.uuid) return payload.uuid;
  if (typeof payload.id === 'string' && payload.id) return payload.id;
  if (payload.data && typeof payload.data === 'object') {
    if (typeof payload.data.uuid === 'string' && payload.data.uuid) return payload.data.uuid;
    if (typeof payload.data.id === 'string' && payload.data.id) return payload.data.id;
  }
  return null;
}

function normalizeLinkedInUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${path}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function linkedinCandidates(input?: string | null): { url: string | null; slug: string | null } {
  if (!input) return { url: null, slug: null };
  const normalized = normalizeLinkedInUrl(input);
  const slugMatch = normalized.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return {
    url: normalized || null,
    slug: slugMatch?.[1] || null,
  };
}

async function lookupOneContact(payload: Record<string, unknown>): Promise<string | null> {
  try {
    const response = await fetch(`${GETSALES_BASE_URL}/leads/api/leads/lookup-one`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ...payload,
        disable_aggregation: true,
      }),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json().catch(() => ({}))) as ProspectLikeResponse;
    return extractUuid(data);
  } catch {
    return null;
  }
}

/**
 * Look up a contact in GetSales.io by LinkedIn URL or email.
 * Returns the GetSales UUID if found.
 */
export async function lookupContact(
  linkedinUrl?: string | null,
  email?: string | null,
  firstName?: string | null,
  lastName?: string | null,
  company?: string | null
): Promise<string | null> {
  if (!process.env.GETSALES_API_KEY) return null;
  const linkedIn = linkedinCandidates(linkedinUrl);

  // Try lookup by LinkedIn first (docs: linkedin_id accepts URL or nickname).
  if (linkedIn.url || linkedinUrl) {
    const linkedInVariants = Array.from(new Set([
      linkedIn.url,
      linkedIn.slug,
      linkedinUrl,
    ].filter((value): value is string => Boolean(value && value.trim()))));
    for (const candidate of linkedInVariants) {
      const uuid = await lookupOneContact({ linkedin_id: candidate });
      if (uuid) return uuid;
    }
  }

  // Try lookup by email
  if (email) {
    const uuid = await lookupOneContact({ email: email.trim() });
    if (uuid) return uuid;
  }

  // Final documented fallback: name + company_name.
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName && company?.trim()) {
    const uuid = await lookupOneContact({
      name: fullName,
      company_name: company.trim(),
    });
    if (uuid) return uuid;
  }

  return null;
}

async function createProspect(input: EnsureProspectInput): Promise<string | null> {
  const listUuid = process.env.GETSALES_UPSERT_LIST_UUID;
  if (!listUuid) {
    console.warn('[getsales] GETSALES_UPSERT_LIST_UUID is not configured');
    return null;
  }
  const linkedIn = linkedinCandidates(input.linkedin_url);
  const linkedinId = linkedIn.url || linkedIn.slug || null;
  if (!linkedinId) {
    console.warn('[getsales] Cannot upsert contact without linkedin_id');
    return null;
  }

  const payload = {
    lead: {
      linkedin_id: linkedinId,
      first_name: input.first_name || undefined,
      last_name: input.last_name || undefined,
      company_name: input.company || undefined,
      email: input.email || undefined,
      position: input.title || undefined,
    },
    list_uuid: listUuid,
    update_if_exists: true,
    move_to_list: false,
  };

  try {
    const response = await fetch(`${GETSALES_BASE_URL}/leads/api/leads/upsert`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error('[getsales] Upsert contact failed:', response.status, await response.text());
      return null;
    }
    const data = (await response.json().catch(() => ({}))) as ProspectLikeResponse;
    return extractUuid(data);
  } catch (error) {
    console.error('[getsales] Upsert contact error:', error);
    return null;
  }
}

export async function ensureProspect(input: EnsureProspectInput): Promise<string | null> {
  const existing = await lookupContact(
    input.linkedin_url,
    input.email,
    input.first_name,
    input.last_name,
    input.company
  );
  if (existing) return existing;
  return createProspect(input);
}

async function updateWorkEmailByContactUuid(
  contactUuid: string,
  workEmail: string
): Promise<boolean> {
  const trimmedUuid = contactUuid.trim();
  const trimmedEmail = workEmail.trim();
  if (!trimmedUuid || !trimmedEmail) return false;

  const upsertListUuid = process.env.GETSALES_UPSERT_LIST_UUID?.trim();
  const contactUpsertPayloads: Record<string, unknown>[] = [
    { uuid: trimmedUuid, work_email: trimmedEmail },
    { contact_uuid: trimmedUuid, work_email: trimmedEmail },
    { id: trimmedUuid, work_email: trimmedEmail },
    { contact: { uuid: trimmedUuid, work_email: trimmedEmail } },
    { uuid: trimmedUuid, email: trimmedEmail, work_email: trimmedEmail },
  ];
  const leadUpsertPayloads: Record<string, unknown>[] = [
    {
      lead: { uuid: trimmedUuid, email: trimmedEmail, work_email: trimmedEmail },
      update_if_exists: true,
      move_to_list: false,
      ...(upsertListUuid ? { list_uuid: upsertListUuid } : {}),
    },
    {
      lead: { uuid: trimmedUuid, email: trimmedEmail },
      update_if_exists: true,
      move_to_list: false,
      ...(upsertListUuid ? { list_uuid: upsertListUuid } : {}),
    },
  ];

  const attempt = async (url: string, payload: Record<string, unknown>): Promise<boolean> => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const baseCandidates = Array.from(
    new Set([GETSALES_BASE_URL.replace(/\/+$/, ''), 'https://api.getsales.io'])
  );

  for (const base of baseCandidates) {
    for (const payload of contactUpsertPayloads) {
      if (await attempt(`${base}/api/openapi/contacts/upsertcontact`, payload)) {
        return true;
      }
    }
    for (const payload of leadUpsertPayloads) {
      if (await attempt(`${base}/leads/api/leads/upsert`, payload)) {
        return true;
      }
    }
  }

  return false;
}

export async function syncLeadWorkEmail(input: SyncWorkEmailInput): Promise<boolean> {
  if (!process.env.GETSALES_API_KEY) return false;
  const workEmail = input.work_email?.trim();
  if (!workEmail) return false;

  const existingProspectId = input.getsales_prospect_id?.trim();
  let contactUuid = existingProspectId || null;

  if (!contactUuid) {
    // Prefer stable identifiers (LinkedIn + previous email) when email is being edited.
    contactUuid = await lookupContact(
      input.linkedin_url,
      input.previous_email || input.email || workEmail,
      input.first_name,
      input.last_name,
      input.company
    );
  }

  if (!contactUuid) return false;
  return updateWorkEmailByContactUuid(contactUuid, workEmail);
}

/**
 * Fetch LinkedIn messages for a contact from GetSales.io API
 */
export async function fetchLinkedInMessages(leadUuid: string): Promise<GetSalesLinkedInMessage[]> {
  try {
    const url = new URL('/flows/api/linkedin-messages', GETSALES_BASE_URL);
    url.searchParams.set('filter[lead_uuid]', leadUuid);
    url.searchParams.set('order-type', 'asc');
    url.searchParams.set('order-field', 'sent_at');
    url.searchParams.set('limit', '100');

    const response = await fetch(url.toString(), { headers: getHeaders() });

    if (!response.ok) {
      console.error('[getsales] LinkedIn messages fetch failed:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return (data.data || []) as GetSalesLinkedInMessage[];
  } catch (error) {
    console.error('[getsales] Error fetching LinkedIn messages:', error);
    return [];
  }
}

export async function fetchLinkedInConnectionEvents(leadUuid: string): Promise<GetSalesLinkedInMessage[]> {
  const candidatePaths = [
    '/flows/api/linkedin-connection-requests',
    '/flows/api/linkedin-connections',
    '/flows/api/linkedin-invites',
  ];

  for (const path of candidatePaths) {
    try {
      const url = new URL(path, GETSALES_BASE_URL);
      url.searchParams.set('filter[lead_uuid]', leadUuid);
      url.searchParams.set('order-type', 'asc');
      url.searchParams.set('order-field', 'created_at');
      url.searchParams.set('limit', '100');
      const response = await fetch(url.toString(), { headers: getHeaders() });
      if (!response.ok) continue;
      const payload = (await response.json().catch(() => ({}))) as Record<string, any>;
      const rows = (payload.data || payload || []) as Array<Record<string, any>>;
      if (!Array.isArray(rows) || rows.length === 0) continue;
      return rows.map((row) => {
        const status = String(row.status || row.event || row.type || '').toLowerCase();
        const accepted =
          status.includes('accept') ||
          status.includes('accepted') ||
          Boolean(row.accepted_at || row.is_accepted);
        return {
          uuid: String(row.uuid || row.id || `${leadUuid}-${row.created_at || row.sent_at || Math.random()}`),
          text: accepted ? 'Connection request accepted' : 'Connection request sent',
          type: accepted ? 'inbox' : 'outbox',
          sent_at: row.sent_at || row.created_at || row.updated_at || null,
          read_at: row.read_at || null,
          status: status || (accepted ? 'accepted' : 'sent'),
          lead_uuid: String(row.lead_uuid || leadUuid),
          sender_profile_uuid: row.sender_profile_uuid || null,
          sender_profile_name: row.sender_profile_name || row.sender_name || null,
          sender_profile_identity:
            row.sender_profile_identity || row.linkedin_identity || row.linkedin_handle || null,
          linkedin_identity: row.linkedin_identity || row.linkedin_handle || null,
          connection_event: accepted ? 'connection_request_accepted' : 'connection_request_sent',
        } as GetSalesLinkedInMessage;
      });
    } catch {
      // Try next endpoint.
    }
  }

  return [];
}

/**
 * Fetch a single email by UUID from GetSales.io API (to get the full body)
 */
export async function fetchEmailDetail(emailUuid: string): Promise<GetSalesEmail | null> {
  try {
    const url = new URL(`/emails/api/emails/${emailUuid}`, GETSALES_BASE_URL);
    const response = await fetch(url.toString(), { headers: getHeaders() });

    if (!response.ok) {
      console.error('[getsales] Email detail fetch failed:', response.status);
      return null;
    }

    const data = await response.json();
    return (data.data || data) as GetSalesEmail;
  } catch (error) {
    console.error('[getsales] Error fetching email detail:', error);
    return null;
  }
}

async function fetchEmailBodyByUuid(emailBodyUuid: string): Promise<string | null> {
  const candidatePaths = [
    `/emails/api/email-bodies/${emailBodyUuid}`,
    `/emails/api/email-body/${emailBodyUuid}`,
    `/emails/api/email-bodies/uuid/${emailBodyUuid}`,
  ];

  for (const path of candidatePaths) {
    try {
      const url = new URL(path, GETSALES_BASE_URL);
      const response = await fetch(url.toString(), { headers: getHeaders() });
      if (!response.ok) continue;
      const payload = await response.json();
      const data = payload?.data || payload;
      const body = data?.body || data?.content || data?.emailBodyDomain?.body || data?.email_body_domain?.body || '';
      if (typeof body === 'string' && body.trim()) {
        return body;
      }
    } catch {
      // Try next candidate endpoint
    }
  }

  return null;
}

function extractEmailBody(payload: GetSalesEmail | null | undefined): string {
  if (!payload) return '';
  return (
    payload.body ||
    payload.text ||
    payload.content ||
    payload.html_body ||
    payload.body_html ||
    payload.body_text ||
    payload.message ||
    payload.email_body?.body ||
    payload.email_body?.content ||
    payload.emailBody?.body ||
    payload.emailBody?.content ||
    payload.email_body_domain?.body ||
    payload.email_body_domain?.content ||
    payload.emailBodyDomain?.body ||
    payload.emailBodyDomain?.content ||
    ''
  );
}

/**
 * Fetch email messages for a contact from GetSales.io API
 */
export async function fetchEmails(leadUuid: string): Promise<GetSalesEmail[]> {
  try {
    const url = new URL('/emails/api/emails', GETSALES_BASE_URL);
    url.searchParams.set('filter[lead_uuid]', leadUuid);
    url.searchParams.set('order-type', 'asc');
    url.searchParams.set('limit', '100');

    const response = await fetch(url.toString(), { headers: getHeaders() });

    if (!response.ok) {
      console.error('[getsales] Email fetch failed:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const emails = (data.data || []) as GetSalesEmail[];

    // Log the FULL raw first email to see all available fields
    if (emails.length > 0) {
      console.log(`[getsales] RAW first email object: ${JSON.stringify(emails[0])}`);
    }

    // Resolve body from list payload first, then fetch per-email detail for missing bodies.
    const withBodies = await Promise.all(
      emails.map(async (email) => {
        const listBody = extractEmailBody(email);
        if (listBody) {
          return { ...email, body: listBody };
        }

        const detail = await fetchEmailDetail(email.uuid);
        if (detail) {
          console.log(`[getsales] RAW email detail for ${email.uuid}: ${JSON.stringify(detail)}`);
          const detailBody = extractEmailBody(detail);
          if (detailBody) {
            return { ...email, body: detailBody };
          }
        }

        if (email.email_body_uuid) {
          const bodyByUuid = await fetchEmailBodyByUuid(email.email_body_uuid);
          if (bodyByUuid) {
            return { ...email, body: bodyByUuid };
          }
        }

        return email;
      })
    );

    return withBodies;
  } catch (error) {
    console.error('[getsales] Error fetching emails:', error);
    return [];
  }
}

export async function fetchSenderProfiles(): Promise<GetSalesSenderProfile[]> {
  try {
    const url = new URL('/flows/api/sender-profiles', GETSALES_BASE_URL);
    url.searchParams.set('limit', '100');
    url.searchParams.set('offset', '0');
    url.searchParams.set('order_field', 'created_at');
    url.searchParams.set('order_type', 'asc');
    const response = await fetch(url.toString(), { headers: getHeaders() });
    if (!response.ok) {
      console.error('[getsales] Sender profiles fetch failed:', response.status, await response.text());
      return [];
    }
    const payload = await response.json();
    return (payload.data || payload || []) as GetSalesSenderProfile[];
  } catch (error) {
    console.error('[getsales] Error fetching sender profiles:', error);
    return [];
  }
}

export async function fetchMailbox(mailboxUuid: string): Promise<GetSalesMailbox | null> {
  try {
    const url = new URL(`/emails/api/mailboxes/${mailboxUuid}`, GETSALES_BASE_URL);
    const response = await fetch(url.toString(), { headers: getHeaders() });
    if (!response.ok) {
      console.error('[getsales] Mailbox fetch failed:', response.status, await response.text());
      return null;
    }
    return (await response.json()) as GetSalesMailbox;
  } catch (error) {
    console.error('[getsales] Error fetching mailbox:', error);
    return null;
  }
}

export async function fetchMailboxes(): Promise<GetSalesMailbox[]> {
  try {
    const url = new URL('/emails/api/mailboxes', GETSALES_BASE_URL);
    url.searchParams.set('limit', '200');
    url.searchParams.set('offset', '0');
    url.searchParams.set('order_field', 'created_at');
    url.searchParams.set('order_type', 'asc');
    const response = await fetch(url.toString(), { headers: getHeaders() });
    if (!response.ok) {
      console.error('[getsales] Mailboxes list fetch failed:', response.status, await response.text());
      return [];
    }
    const payload = await response.json();
    return (payload.data || payload || []) as GetSalesMailbox[];
  } catch (error) {
    console.error('[getsales] Error fetching mailboxes list:', error);
    return [];
  }
}

export async function fetchLinkedInAccount(accountUuid: string): Promise<GetSalesLinkedInAccount | null> {
  const candidatePaths = [
    `/flows/api/linkedin-accounts/${accountUuid}`,
    `/flows/api/linkedin-account/${accountUuid}`,
    `/linkedin/api/accounts/${accountUuid}`,
    `/linkedin/api/linkedin-accounts/${accountUuid}`,
  ];

  for (const path of candidatePaths) {
    try {
      const url = new URL(path, GETSALES_BASE_URL);
      const response = await fetch(url.toString(), { headers: getHeaders() });
      if (!response.ok) continue;
      const payload = await response.json();
      const data = (payload?.data || payload) as GetSalesLinkedInAccount;
      if (data && typeof data === 'object') {
        return data;
      }
    } catch {
      // Try next endpoint shape.
    }
  }

  return null;
}

export async function sendLinkedInMessage(params: {
  sender_profile_uuid: string;
  lead_uuid: string;
  text: string;
}) {
  const response = await fetch(`${GETSALES_BASE_URL}/flows/api/linkedin-messages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `LinkedIn send failed (${response.status})`);
  }
  return payload;
}

export async function sendEmail(params: {
  sender_profile_uuid: string;
  lead_uuid: string;
  mailbox_uuid?: string;
  from_name: string;
  from_email: string;
  to_name: string;
  to_email: string;
  subject: string;
  body: string;
  replied_to_uuid?: string;
  attachments?: Array<{
    filename: string;
    content_type?: string;
    content_base64: string;
    size?: number;
  }>;
}): Promise<Record<string, unknown>> {
  const baseUrl = GETSALES_BASE_URL.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/emails/api/emails/send-email`;

  const base: Record<string, unknown> = {
    sender_profile_uuid: params.sender_profile_uuid,
    lead_uuid: params.lead_uuid,
    from_name: params.from_name,
    from_email: params.from_email,
    to: [{ to_name: params.to_name || '', to_email: params.to_email }],
    to_name: params.to_name || null,
    to_email: params.to_email,
    cc: [],
    bcc: [],
    subject: params.subject,
    body: params.body,
  };
  if (params.mailbox_uuid) {
    base.mailbox_uuid = params.mailbox_uuid;
  }

  const safeAttachments = Array.isArray(params.attachments) && params.attachments.length > 0
    ? params.attachments.map(a => ({
        filename: a.filename,
        content: a.content_base64,
        content_type: a.content_type || 'application/octet-stream',
      }))
    : undefined;

  const attemptPayloads: Record<string, unknown>[] = [
    { ...base, ...(safeAttachments ? { attachments: safeAttachments } : {}) },
    { ...base, ...(safeAttachments ? { emailBodyDomain: { body: params.body, subject: params.subject, attachments: safeAttachments } } : {}), type: 'outbox' },
  ];

  console.log('[getsales] send-email values:', JSON.stringify({
    sender_profile_uuid: params.sender_profile_uuid,
    lead_uuid: params.lead_uuid,
    mailbox_uuid: params.mailbox_uuid || 'NOT SET',
    from_name: params.from_name,
    from_email: params.from_email,
    to_name: params.to_name,
    to_email: params.to_email,
    subject: params.subject,
    body_length: params.body?.length ?? 0,
    attachments_count: params.attachments?.length ?? 0,
    attachment_names: params.attachments?.map(a => a.filename) ?? [],
  }));

  const collectedErrors: string[] = [];
  for (const payload of attemptPayloads) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const rawText = await response.text();
    let responsePayload: Record<string, unknown> = {};
    try { responsePayload = JSON.parse(rawText) as Record<string, unknown>; } catch { /* non-json */ }

    if (response.ok) {
      return responsePayload;
    }
    const payloadKeys = Object.keys(payload).join(',');
    console.error(`[getsales] send-email rejected (${response.status}) [keys=${payloadKeys}] FULL RESPONSE:`, rawText);
    const message =
      (typeof responsePayload.message === 'string' && responsePayload.message) ||
      (typeof responsePayload.error === 'string' && responsePayload.error) ||
      `Email send failed (${response.status})`;
    const entry = `${message} [keys=${payloadKeys}]`;
    collectedErrors.push(entry);
    if (response.status !== 422 && response.status !== 400) {
      break;
    }
  }

  throw new Error(collectedErrors.join(' || ') || 'Unknown GetSales send-email error');
}
