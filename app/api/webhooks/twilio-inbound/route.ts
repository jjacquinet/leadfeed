import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

function normalizeDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const from = (formData.get('From') as string) || '';
    const body = (formData.get('Body') as string) || '';
    const messageSid = (formData.get('MessageSid') as string) || '';

    if (!from || !body.trim()) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const incomingDigits = normalizeDigits(from);
    if (!incomingDigits) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const supabase = getSupabase();

    const { data: leads } = await supabase
      .from('leads')
      .select('id, phone, phone_numbers')
      .not('phone_numbers', 'is', null);

    let matchedLeadId: string | null = null;

    if (leads) {
      for (const lead of leads) {
        const numbers: string[] = Array.isArray(lead.phone_numbers)
          ? lead.phone_numbers
          : [];
        if (lead.phone) numbers.push(lead.phone);

        for (const num of numbers) {
          if (normalizeDigits(num) === incomingDigits) {
            matchedLeadId = lead.id;
            break;
          }
        }
        if (matchedLeadId) break;
      }
    }

    if (!matchedLeadId && leads) {
      const { data: phoneFallback } = await supabase
        .from('leads')
        .select('id, phone')
        .not('phone', 'is', null);

      if (phoneFallback) {
        for (const lead of phoneFallback) {
          if (lead.phone && normalizeDigits(lead.phone) === incomingDigits) {
            matchedLeadId = lead.id;
            break;
          }
        }
      }
    }

    if (!matchedLeadId) {
      console.log(`[twilio-inbound] No lead match for ${from}, ignoring`);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const now = new Date().toISOString();

    await supabase.from('activities').insert({
      lead_id: matchedLeadId,
      type: 'text_received',
      channel: 'text',
      direction: 'inbound',
      content: body.trim(),
      metadata: {
        twilio_sid: messageSid,
        from,
      },
      created_at: now,
    });

    await supabase
      .from('leads')
      .update({
        has_unread: true,
        last_inbound_at: now,
        last_activity: now,
        last_activity_at: now,
        updated_at: now,
      })
      .eq('id', matchedLeadId);

    console.log(`[twilio-inbound] Recorded inbound SMS from ${from} for lead ${matchedLeadId}`);

    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error) {
    console.error('[twilio-inbound] Error:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
