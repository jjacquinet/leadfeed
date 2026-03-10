import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { mergePhoneNumbers, normalizePhoneNumbers, primaryPhoneFromList } from '@/lib/phones';

function collectPhones(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number') {
    const candidate = String(value);
    return /\d{7,}/.test(candidate) ? [candidate] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPhones(item));
  }
  if (typeof value === 'object') {
    const out: string[] = [];
    for (const [key, nested] of Object.entries(value)) {
      if (key.toLowerCase().includes('phone')) {
        out.push(...collectPhones(nested));
      } else if (nested && typeof nested === 'object') {
        out.push(...collectPhones(nested));
      }
    }
    return out;
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });
    }

    const payload = await request.json().catch(() => ({}));
    const incomingPhones = normalizePhoneNumbers(collectPhones(payload));

    if (incomingPhones.length === 0) {
      return NextResponse.json({ success: true, updated: false, reason: 'no_phone_numbers_in_payload' });
    }

    const supabase = getServiceClient();
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, phone, phone_numbers')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const existingPhones = normalizePhoneNumbers([
      ...(Array.isArray(lead.phone_numbers) ? lead.phone_numbers : []),
      lead.phone,
    ]);
    const mergedPhones = mergePhoneNumbers(existingPhones, incomingPhones);

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        phone_numbers: mergedPhones,
        phone: primaryPhoneFromList(mergedPhones),
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('[apollo-webhook] failed to update lead phones', updateError);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: true, total: mergedPhones.length });
  } catch (error) {
    console.error('[apollo-webhook] error', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
