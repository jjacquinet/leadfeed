import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Normalize a GetSales.io payload (or any similar webhook) into our internal format.
 * Handles both snake_case and camelCase field names, plus common variations.
 */
function normalizePayload(raw: any) {
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return String(raw[k]);
    }
    return undefined;
  };

  const firstName = get('first_name', 'firstName', 'First Name', 'first name', 'fname');
  const lastName = get('last_name', 'lastName', 'Last Name', 'last name', 'lname');

  // Some webhooks send a single "name" field
  let derivedFirst = firstName;
  let derivedLast = lastName;
  if (!derivedFirst && !derivedLast) {
    const fullName = get('name', 'fullName', 'full_name', 'Full Name', 'contact_name');
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      derivedFirst = parts[0];
      derivedLast = parts.slice(1).join(' ') || 'Unknown';
    }
  }

  // Normalize messages array — handle both our format and GetSales variations
  let messages: { direction: string; content: string; timestamp?: string }[] = [];
  const rawMessages = raw.messages || raw.conversation || raw.message_history;
  if (Array.isArray(rawMessages)) {
    messages = rawMessages.map((msg: any) => ({
      direction: msg.direction || msg.type || 'outbound',
      content: msg.content || msg.text || msg.body || msg.message || '',
      timestamp: msg.timestamp || msg.date || msg.sent_at || msg.created_at,
    }));
  } else if (raw.message || raw.last_message || raw.conversation_text) {
    // Single message field — treat as latest inbound reply
    const content = raw.message || raw.last_message || raw.conversation_text;
    if (content) {
      messages = [{ direction: 'inbound', content: String(content) }];
    }
  }

  return {
    first_name: derivedFirst,
    last_name: derivedLast,
    email: get('email', 'Email', 'email_address', 'emailAddress'),
    phone: get('phone', 'Phone', 'phone_number', 'phoneNumber', 'mobile'),
    title: get('title', 'Title', 'job_title', 'jobTitle', 'position', 'Position', 'role'),
    company: get('company', 'Company', 'company_name', 'companyName', 'organization'),
    linkedin_url: get('linkedin_url', 'linkedinUrl', 'linkedin', 'LinkedIn', 'linkedin_profile', 'linkedInUrl', 'profile_url', 'profileUrl'),
    company_website: get('company_website', 'companyWebsite', 'website', 'Website', 'company_url', 'domain'),
    campaign_name: get('campaign_name', 'campaignName', 'campaign', 'Campaign', 'campaign_id'),
    channel: get('channel', 'Channel', 'source_channel') || 'linkedin',
    messages,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Auth: support both query param (?key=...) and header (x-api-key)
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('key') || request.headers.get('x-api-key');
    const expectedKey = process.env.WEBHOOK_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawPayload = await request.json();

    // Log the raw payload so we can debug field mapping
    console.log('[webhook] Raw payload from GetSales.io:', JSON.stringify(rawPayload, null, 2));

    const payload = normalizePayload(rawPayload);

    console.log('[webhook] Normalized payload:', JSON.stringify(payload, null, 2));

    if (!payload.first_name || !payload.last_name) {
      console.error('[webhook] Missing name fields. Raw keys:', Object.keys(rawPayload));
      return NextResponse.json(
        {
          error: 'Missing required fields: first_name, last_name',
          received_keys: Object.keys(rawPayload),
        },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

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

    const now = new Date().toISOString();

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

      if (payload.messages.length > 0) {
        const messages = payload.messages.map((msg) => ({
          lead_id: existingLead.id,
          channel: payload.channel || 'linkedin',
          direction: msg.direction,
          content: msg.content,
          is_note: false,
          timestamp: msg.timestamp || now,
        }));
        await supabase.from('messages').insert(messages);
      }

      console.log('[webhook] Updated existing lead:', existingLead.id);
      return NextResponse.json({
        success: true,
        action: 'updated',
        lead_id: existingLead.id,
      });
    } else {
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          first_name: payload.first_name,
          last_name: payload.last_name,
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
        console.error('[webhook] Error creating lead:', leadError);
        return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
      }

      if (payload.messages.length > 0) {
        const messages = payload.messages.map((msg) => ({
          lead_id: newLead.id,
          channel: payload.channel || 'linkedin',
          direction: msg.direction,
          content: msg.content,
          is_note: false,
          timestamp: msg.timestamp || now,
        }));
        await supabase.from('messages').insert(messages);
      }

      console.log('[webhook] Created new lead:', newLead.id);
      return NextResponse.json({
        success: true,
        action: 'created',
        lead_id: newLead.id,
      });
    }
  } catch (error) {
    console.error('[webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
