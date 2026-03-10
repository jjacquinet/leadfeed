import { NextRequest, NextResponse } from 'next/server';
import { enrichPhonesFromApollo } from '@/lib/apollo';
import { getSupabase } from '@/lib/supabase';
import { mergePhoneNumbers, normalizePhoneNumbers, primaryPhoneFromList } from '@/lib/phones';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const leadId = body?.id as string | undefined;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, email, linkedin_url, phone, phone_numbers')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!lead.linkedin_url && !lead.email) {
      return NextResponse.json(
        { error: 'Lead requires LinkedIn URL or email for enrichment' },
        { status: 400 }
      );
    }

    const existingPhones = normalizePhoneNumbers([
      ...(Array.isArray(lead.phone_numbers) ? lead.phone_numbers : []),
      lead.phone,
    ]);

    const requestOrigin = new URL(request.url).origin;
    const webhookBaseUrl =
      process.env.APOLLO_WEBHOOK_URL || `${requestOrigin}/api/webhooks/apollo`;
    const webhookUrl = `${webhookBaseUrl}${webhookBaseUrl.includes('?') ? '&' : '?'}lead_id=${encodeURIComponent(leadId)}`;

    const enrichment = await enrichPhonesFromApollo({
      linkedinUrl: lead.linkedin_url,
      email: lead.email,
      webhookUrl,
    });

    const mergedPhones = mergePhoneNumbers(existingPhones, enrichment.phones);
    const added = Math.max(0, mergedPhones.length - existingPhones.length);

    const updates = {
      phone_numbers: mergedPhones,
      phone: primaryPhoneFromList(mergedPhones),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError || !updatedLead) {
      console.error('Error updating enriched phone numbers:', updateError);
      return NextResponse.json({ error: 'Failed to save enriched phone numbers' }, { status: 500 });
    }

    return NextResponse.json({
      lead: updatedLead,
      added,
      total: mergedPhones.length,
      found: enrichment.phones.length,
      queued: enrichment.deferred,
    });
  } catch (error) {
    console.error('Error enriching phone number:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Phone enrichment failed' },
      { status: 500 }
    );
  }
}
