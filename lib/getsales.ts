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
}

export interface GetSalesEmail {
  uuid: string;
  subject: string;
  body: string;
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
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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

/**
 * Look up a contact in GetSales.io by LinkedIn URL or email.
 * Returns the GetSales UUID if found.
 */
export async function lookupContact(linkedinUrl?: string | null, email?: string | null): Promise<string | null> {
  if (!process.env.GETSALES_API_KEY) return null;

  // Try lookup by LinkedIn URL first
  if (linkedinUrl) {
    try {
      const response = await fetch(`${GETSALES_BASE_URL}/leads/api/leads/lookup-one`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ linkedin_url: linkedinUrl }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.uuid) return data.uuid;
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

  // Try search as fallback
  if (linkedinUrl) {
    try {
      // Extract the LinkedIn username/slug from the URL
      const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?]+)/);
      const linkedin = match ? match[1] : null;
      if (linkedin) {
        const response = await fetch(`${GETSALES_BASE_URL}/leads/api/leads/search`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ filter: { linkedin } }),
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

  return null;
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
  from_name: string;
  from_email: string;
  to_name: string;
  to_email: string;
  subject: string;
  body: string;
}) {
  const response = await fetch(`${GETSALES_BASE_URL}/emails/api/emails/send-email`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      ...params,
      cc: [],
      bcc: [],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Email send failed (${response.status})`);
  }
  return payload;
}
