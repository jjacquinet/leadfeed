import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Deep search: recursively look through the payload for a value matching any of the given keys.
 * Searches nested objects (but not arrays of objects beyond the first level).
 */
function deepGet(obj: any, ...keys: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  // First check top-level keys
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      return String(obj[k]);
    }
  }

  // Then check one level of common wrapper keys
  const wrappers = ['contact', 'data', 'lead', 'person', 'prospect', 'payload', 'body', 'record'];
  for (const w of wrappers) {
    if (obj[w] && typeof obj[w] === 'object' && !Array.isArray(obj[w])) {
      for (const k of keys) {
        if (obj[w][k] !== undefined && obj[w][k] !== null && obj[w][k] !== '') {
          return String(obj[w][k]);
        }
      }
    }
  }

  return undefined;
}

/**
 * Normalize any GetSales.io payload into our internal lead format.
 */
function normalizePayload(raw: any) {
  const firstName = deepGet(raw, 'first_name', 'firstName', 'First Name', 'fname', 'first');
  const lastName = deepGet(raw, 'last_name', 'lastName', 'Last Name', 'lname', 'last');

  let derivedFirst = firstName;
  let derivedLast = lastName;

  if (!derivedFirst && !derivedLast) {
    const fullName = deepGet(raw, 'name', 'fullName', 'full_name', 'Full Name', 'contact_name', 'display_name');
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      derivedFirst = parts[0];
      derivedLast = parts.slice(1).join(' ') || 'Unknown';
    }
  }

  // Company info might be in an "account" sub-object (GetSales.io pattern)
  const companyFromAccount = raw.account?.name;
  const websiteFromAccount = raw.account?.website || raw.account?.domain;
  const companyLinkedinFromAccount = raw.account?.linkedin_url;

  // Person's LinkedIn URL
  const linkedinUrl = deepGet(raw, 'linkedin_url', 'linkedinUrl', 'linkedin', 'LinkedIn',
    'linkedin_profile', 'linkedInUrl', 'profile_url', 'profileUrl', 'ln_url', 'social_url');

  // Title/headline
  const title = deepGet(raw, 'title', 'Title', 'job_title', 'jobTitle', 'position',
    'Position', 'role', 'headline', 'Headline');

  // Messages
  let messages: { direction: string; content: string; timestamp?: string }[] = [];
  const rawMessages = raw.messages || raw.conversation || raw.message_history;
  if (Array.isArray(rawMessages) && rawMessages.length > 0) {
    messages = rawMessages
      .filter((msg: any) => {
        const content = msg.content || msg.text || msg.body || msg.message;
        return content && String(content).trim().length > 0;
      })
      .map((msg: any) => ({
        direction: msg.direction || msg.type || (msg.is_reply ? 'inbound' : 'outbound'),
        content: String(msg.content || msg.text || msg.body || msg.message),
        timestamp: msg.timestamp || msg.date || msg.sent_at || msg.created_at,
      }));
  } else if (raw.message || raw.last_message || raw.conversation_text) {
    const content = raw.message || raw.last_message || raw.conversation_text;
    if (content) {
      messages = [{ direction: 'inbound', content: String(content) }];
    }
  }

  return {
    first_name: derivedFirst || null,
    last_name: derivedLast || null,
    email: deepGet(raw, 'email', 'Email', 'email_address', 'emailAddress', 'work_email'),
    phone: deepGet(raw, 'phone', 'Phone', 'phone_number', 'phoneNumber', 'mobile', 'work_phone'),
    title,
    company: deepGet(raw, 'company', 'Company', 'company_name', 'companyName', 'organization') || companyFromAccount,
    linkedin_url: linkedinUrl,
    company_website: deepGet(raw, 'company_website', 'companyWebsite', 'website', 'Website', 'company_url', 'domain') || websiteFromAccount,
    campaign_name: deepGet(raw, 'campaign_name', 'campaignName', 'campaign', 'Campaign', 'campaign_id',
      'pipeline_stage_name') || raw.account?.pipeline_stage_name,
    channel: deepGet(raw, 'channel', 'Channel', 'source_channel') || 'linkedin',
    messages,
    // Keep track of account LinkedIn for potential use
    company_linkedin: companyLinkedinFromAccount,
  };
}

/**
 * Parse the request body regardless of content type.
 */
async function parseBody(request: NextRequest): Promise<any> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const obj: Record<string, any> = {};
    formData.forEach((value, key) => {
      // Try to parse JSON values within form fields
      try {
        obj[key] = JSON.parse(value as string);
      } catch {
        obj[key] = value;
      }
    });
    return obj;
  }

  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch {
    const params = new URLSearchParams(text);
    const obj: Record<string, any> = {};
    params.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
}

// GET handler — webhook URL verification
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Webhook is active. Send POST with lead data.' });
}

// PUT handler — redirect to POST
export async function PUT(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    // Auth: support query param (?key=...) and header (x-api-key) — log but don't reject
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('key') || request.headers.get('x-api-key');
    const expectedKey = process.env.WEBHOOK_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
      console.log('[webhook] Auth mismatch — proceeding anyway for now');
    }

    const rawPayload = await parseBody(request);

    // Log everything for debugging
    console.log('[webhook] Content-Type:', request.headers.get('content-type'));
    console.log('[webhook] Raw keys:', Object.keys(rawPayload));
    console.log('[webhook] Raw payload:', JSON.stringify(rawPayload).substring(0, 2000));

    const payload = normalizePayload(rawPayload);
    console.log('[webhook] Normalized:', JSON.stringify(payload, null, 2));

    // Use fallback names if not found — NEVER reject a payload
    const firstName = payload.first_name || 'Unknown';
    const lastName = payload.last_name || 'Contact';

    const supabase = getServiceClient();
    const now = new Date().toISOString();

    // Check for duplicate by LinkedIn URL or email
    let existingLead = null;
    if (payload.linkedin_url) {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('linkedin_url', payload.linkedin_url)
        .single();
      existingLead = data;
    }
    if (!existingLead && payload.email) {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('email', payload.email)
        .single();
      existingLead = data;
    }

    if (existingLead) {
      const updates: Record<string, unknown> = {
        updated_at: now,
        last_activity: now,
      };
      if (payload.email && !existingLead.email) updates.email = payload.email;
      if (payload.phone && !existingLead.phone) updates.phone = payload.phone;
      if (payload.title) updates.title = payload.title;
      if (payload.company) updates.company = payload.company;
      if (payload.company_website && !existingLead.company_website) {
        updates.company_website = payload.company_website;
      }

      if (existingLead.stage === 'snoozed') {
        updates.stage = 'lead_feed';
        updates.snoozed_until = null;
      }

      await supabase.from('leads').update(updates).eq('id', existingLead.id);

      // Add messages
      if (payload.messages.length > 0) {
        const msgs = payload.messages.map((msg) => ({
          lead_id: existingLead.id,
          channel: payload.channel || 'linkedin',
          direction: msg.direction,
          content: msg.content,
          is_note: false,
          timestamp: msg.timestamp || now,
        }));
        await supabase.from('messages').insert(msgs);
      }

      // Store raw payload as a debug note
      await supabase.from('messages').insert({
        lead_id: existingLead.id,
        channel: 'linkedin',
        direction: 'outbound',
        content: `[Raw webhook payload]\n${JSON.stringify(rawPayload, null, 2).substring(0, 3000)}`,
        is_note: true,
        timestamp: now,
      });

      console.log('[webhook] Updated lead:', existingLead.id);
      return NextResponse.json({ success: true, action: 'updated', lead_id: existingLead.id });

    } else {
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: payload.email || null,
          phone: payload.phone || null,
          title: payload.title || null,
          company: payload.company || null,
          linkedin_url: payload.linkedin_url || null,
          company_website: payload.company_website || null,
          stage: 'lead_feed',
          source: 'getsales_webhook',
          campaign_name: payload.campaign_name || null,
          created_at: now,
          updated_at: now,
          last_activity: now,
        })
        .select()
        .single();

      if (leadError || !newLead) {
        console.error('[webhook] DB error:', leadError);
        return NextResponse.json({ error: 'DB insert failed', details: leadError }, { status: 500 });
      }

      // Add messages
      if (payload.messages.length > 0) {
        const msgs = payload.messages.map((msg) => ({
          lead_id: newLead.id,
          channel: payload.channel || 'linkedin',
          direction: msg.direction,
          content: msg.content,
          is_note: false,
          timestamp: msg.timestamp || now,
        }));
        await supabase.from('messages').insert(msgs);
      }

      // Store raw payload as a debug note so we can inspect it in the app
      await supabase.from('messages').insert({
        lead_id: newLead.id,
        channel: 'linkedin',
        direction: 'outbound',
        content: `[Raw webhook payload]\n${JSON.stringify(rawPayload, null, 2).substring(0, 3000)}`,
        is_note: true,
        timestamp: now,
      });

      console.log('[webhook] Created lead:', newLead.id, `(${firstName} ${lastName})`);
      return NextResponse.json({ success: true, action: 'created', lead_id: newLead.id });
    }
  } catch (error) {
    console.error('[webhook] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error', message: String(error) }, { status: 500 });
  }
}
