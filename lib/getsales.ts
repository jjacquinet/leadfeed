/* eslint-disable @typescript-eslint/no-explicit-any */

const GETSALES_BASE_URL = process.env.GETSALES_BASE_URL || 'https://amazing.getsales.io';

function getHeaders(): HeadersInit {
  const apiKey = process.env.GETSALES_API_KEY;
  if (!apiKey) throw new Error('GETSALES_API_KEY not configured');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
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
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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

    // Try to resolve body from alternative field names
    for (const email of emails) {
      if (!email.body) {
        email.body = email.text || email.content || email.html_body || email.body_html || email.body_text || email.message || '';
      }
    }

    // If list endpoint returns empty bodies, fetch individual emails for full content
    const needsDetail = emails.length > 0 && !emails[0].body;
    if (needsDetail) {
      console.log(`[getsales] Email list missing bodies, fetching ${emails.length} individual emails...`);
      const detailed = await Promise.all(
        emails.map(async (email) => {
          const detail = await fetchEmailDetail(email.uuid);
          if (detail) {
            console.log(`[getsales] RAW email detail for ${email.uuid}: ${JSON.stringify(detail)}`);
            const detailBody = detail.body || detail.text || detail.content || detail.html_body || detail.body_html || detail.body_text || detail.message || '';
            if (detailBody) {
              return { ...email, body: detailBody };
            }
          }
          return email;
        })
      );
      return detailed;
    }

    return emails;
  } catch (error) {
    console.error('[getsales] Error fetching emails:', error);
    return [];
  }
}
