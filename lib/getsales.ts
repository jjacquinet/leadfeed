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

type GetSalesLeadLite = {
  uuid?: string;
  id?: string;
  email?: string | null;
  linkedin_url?: string | null;
  linkedin?: string | null;
  profile_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  company?: string | null;
  [key: string]: any;
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

function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

function extractLinkedInSlug(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = trimmed.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
  if (direct) return direct.toLowerCase();
  if (/^[a-z0-9-._]+$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

async function listLeadsAndMatch(input: {
  email?: string | null;
  linkedin_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
}): Promise<string | null> {
  const candidatePaths = ['/leads/api/leads', '/leads/api/prospects'];
  const targetEmail = normalizeEmail(input.email);
  const linkedIn = linkedinCandidates(input.linkedin_url);
  const targetSlug = linkedIn.slug?.toLowerCase() || null;
  const targetLinkedInUrl = linkedIn.url || null;
  const targetName = [input.first_name, input.last_name].filter(Boolean).join(' ').trim().toLowerCase();
  const targetCompany = input.company?.trim().toLowerCase() || null;

  for (const path of candidatePaths) {
    for (let offset = 0; offset <= 400; offset += 100) {
      try {
        const url = new URL(path, GETSALES_BASE_URL);
        url.searchParams.set('limit', '100');
        url.searchParams.set('offset', String(offset));
        const response = await fetch(url.toString(), { headers: getHeaders() });
        if (!response.ok) break;
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const rows = (payload.data || payload || []) as GetSalesLeadLite[];
        if (!Array.isArray(rows) || rows.length === 0) break;

        for (const row of rows) {
          const rowUuid = extractUuid(row as ProspectLikeResponse);
          if (!rowUuid) continue;

          const rowEmail = normalizeEmail(typeof row.email === 'string' ? row.email : null);
          if (targetEmail && rowEmail && targetEmail === rowEmail) {
            return rowUuid;
          }

          const rowLinkedInUrl =
            typeof row.linkedin_url === 'string'
              ? normalizeLinkedInUrl(row.linkedin_url)
              : typeof row.profile_url === 'string'
                ? normalizeLinkedInUrl(row.profile_url)
                : null;
          const rowLinkedInSlug = extractLinkedInSlug(
            typeof row.linkedin === 'string'
              ? row.linkedin
              : rowLinkedInUrl
          );

          if (targetLinkedInUrl && rowLinkedInUrl && targetLinkedInUrl === rowLinkedInUrl) {
            return rowUuid;
          }
          if (targetSlug && rowLinkedInSlug && targetSlug === rowLinkedInSlug) {
            return rowUuid;
          }

          if (targetName) {
            const rowName = [
              typeof row.first_name === 'string' ? row.first_name : null,
              typeof row.last_name === 'string' ? row.last_name : null,
            ].filter(Boolean).join(' ').trim().toLowerCase()
              || (typeof row.name === 'string' ? row.name.trim().toLowerCase() : '');
            const rowCompany = typeof row.company === 'string' ? row.company.trim().toLowerCase() : null;
            if (rowName && rowName === targetName) {
              if (!targetCompany || !rowCompany || targetCompany === rowCompany) {
                return rowUuid;
              }
            }
          }
        }
      } catch {
        break;
      }
    }
  }

  return null;
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

  // Try lookup by LinkedIn URL first (canonicalized + raw form)
  if (linkedIn.url || linkedinUrl) {
    const linkedInVariants = Array.from(
      new Set(
        [linkedIn.url, linkedinUrl].filter((value): value is string => Boolean(value && value.trim()))
      )
    );
    try {
      for (const candidate of linkedInVariants) {
        const response = await fetch(`${GETSALES_BASE_URL}/leads/api/leads/lookup-one`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ linkedin_url: candidate }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.uuid) return data.uuid;
        }
      }
    } catch (error) {
      console.error('[getsales] LinkedIn lookup failed:', error);
    }
  }

  // Try lookup by email
  if (email) {
    try {
      const response = await fetch(`${GETSALES_BASE_URL}/leads/api/leads/lookup-one`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.uuid) return data.uuid;
      }
    } catch (error) {
      console.error('[getsales] Email lookup failed:', error);
    }
  }

  // Try search fallbacks by slug and canonical URL
  if (linkedIn.slug || linkedIn.url) {
    try {
      if (linkedIn.slug) {
        const response = await fetch(`${GETSALES_BASE_URL}/leads/api/leads/search`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ filter: { linkedin: linkedIn.slug } }),
        });
        if (response.ok) {
          const data = await response.json();
          const results = data?.data || data;
          if (Array.isArray(results) && results.length > 0 && results[0].uuid) {
            return results[0].uuid;
          }
        }
      }

      if (linkedIn.url) {
        const response = await fetch(`${GETSALES_BASE_URL}/leads/api/leads/search`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ filter: { linkedin_url: linkedIn.url } }),
        });
        if (response.ok) {
          const data = await response.json();
          const results = data?.data || data;
          if (Array.isArray(results) && results.length > 0 && results[0].uuid) {
            return results[0].uuid;
          }
        }
      }
    } catch (error) {
      console.error('[getsales] Search lookup failed:', error);
    }
  }

  // Last resort: list leads/prospects and match locally by email/linkedin/name.
  const matchedFromList = await listLeadsAndMatch({
    email,
    linkedin_url: linkedIn.url || linkedinUrl || null,
    first_name: firstName || null,
    last_name: lastName || null,
    company: company || null,
  });
  if (matchedFromList) return matchedFromList;

  return null;
}

async function createProspect(input: EnsureProspectInput): Promise<string | null> {
  const candidatePaths = [
    '/leads/api/leads',
    '/leads/api/lead',
    '/flows/api/prospects',
  ];
  const linkedIn = linkedinCandidates(input.linkedin_url);
  const payloadVariants: Record<string, unknown>[] = [
    {
      first_name: input.first_name || undefined,
      last_name: input.last_name || undefined,
      email: input.email || undefined,
      linkedin_url: linkedIn.url || input.linkedin_url || undefined,
      linkedin: linkedIn.slug || undefined,
      title: input.title || undefined,
      company: input.company || undefined,
      company_name: input.company || undefined,
    },
    {
      name: [input.first_name, input.last_name].filter(Boolean).join(' ').trim() || undefined,
      email: input.email || undefined,
      linkedin_url: linkedIn.url || input.linkedin_url || undefined,
      linkedin: linkedIn.slug || undefined,
      title: input.title || undefined,
      company: input.company || undefined,
      company_name: input.company || undefined,
    },
  ];

  for (const path of candidatePaths) {
    for (const payload of payloadVariants) {
      try {
        const url = new URL(path, GETSALES_BASE_URL);
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) continue;
        const data = (await response.json().catch(() => ({}))) as ProspectLikeResponse;
        const uuid = extractUuid(data);
        if (uuid) return uuid;
      } catch {
        // Try next candidate endpoint.
      }
    }
  }
  return null;
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
  const attachments = (params.attachments || []).map((attachment) => ({
    filename: attachment.filename,
    name: attachment.filename,
    content_type: attachment.content_type || 'application/octet-stream',
    mime_type: attachment.content_type || 'application/octet-stream',
    content_base64: attachment.content_base64,
    data: attachment.content_base64,
    size: attachment.size || undefined,
  }));

  const basePayload: Record<string, unknown> = {
    sender_profile_uuid: params.sender_profile_uuid,
    lead_uuid: params.lead_uuid,
    ...(params.mailbox_uuid ? { mailbox_uuid: params.mailbox_uuid } : {}),
    from_name: params.from_name,
    from_email: params.from_email,
    to_name: params.to_name,
    to_email: params.to_email,
    subject: params.subject,
    body: params.body,
    cc: [],
    bcc: [],
  };

  const executeSend = async (bodyPayload: Record<string, unknown>) =>
    fetch(`${GETSALES_BASE_URL}/emails/api/emails/send-email`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(bodyPayload),
    });

  const attemptPayloads: Record<string, unknown>[] = [
    {
      ...basePayload,
      body: params.body,
      ...(params.replied_to_uuid ? { replied_to_uuid: params.replied_to_uuid } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    },
    {
      ...basePayload,
      body: params.body,
      type: 'outbox',
      ...(params.replied_to_uuid ? { replied_to_uuid: params.replied_to_uuid } : {}),
    },
    {
      ...basePayload,
      // Public API docs show this as required set for send-email.
      ...(params.replied_to_uuid ? { replied_to_uuid: params.replied_to_uuid } : {}),
    },
    {
      ...basePayload,
      emailBodyDomain: {
        body: params.body,
        subject: params.subject,
        attachments: attachments.length > 0 ? attachments : [],
      },
      ...(params.replied_to_uuid ? { replied_to_uuid: params.replied_to_uuid } : {}),
    },
  ];

  let lastError = 'Unknown GetSales send-email error';
  for (const payload of attemptPayloads) {
    const response = await executeSend(payload);
    const responsePayload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) {
      return responsePayload;
    }
    const message = (
      (typeof responsePayload.message === 'string' && responsePayload.message) ||
      (typeof responsePayload.error === 'string' && responsePayload.error) ||
      `Email send failed (${response.status})`
    );
    const errors =
      responsePayload && typeof responsePayload.errors === 'object'
        ? ` | errors=${JSON.stringify(responsePayload.errors)}`
        : '';
    lastError = `${message}${errors}`;
    if (response.status !== 422 && response.status !== 400) {
      break;
    }
  }

  throw new Error(lastError);
}
