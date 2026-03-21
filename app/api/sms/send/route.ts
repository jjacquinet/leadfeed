import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { lead_id, phone_number, message } = body as {
      lead_id?: string;
      phone_number?: string;
      message?: string;
    };

    if (!lead_id || !phone_number?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: lead_id, phone_number, message' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, first_name, last_name')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const client = twilio(accountSid, authToken);
    const twilioMessage = await client.messages.create({
      body: message.trim(),
      from: fromNumber,
      to: phone_number.trim(),
    });

    const now = new Date().toISOString();
    const { data: activity, error: insertError } = await supabase
      .from('activities')
      .insert({
        lead_id,
        type: 'text_sent',
        channel: 'text',
        direction: 'outbound',
        content: message.trim(),
        metadata: {
          twilio_sid: twilioMessage.sid,
          to: phone_number.trim(),
          from: fromNumber,
        },
        created_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[sms/send] Failed to store activity:', insertError);
      return NextResponse.json(
        { error: 'SMS sent but failed to save activity' },
        { status: 500 }
      );
    }

    await supabase
      .from('leads')
      .update({ last_activity: now, last_activity_at: now, updated_at: now })
      .eq('id', lead_id);

    return NextResponse.json({
      id: activity.id,
      lead_id,
      channel: 'text',
      direction: 'outbound',
      content: message.trim(),
      twilio_sid: twilioMessage.sid,
      created_at: activity.created_at,
    });
  } catch (error) {
    console.error('[sms/send] Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to send SMS';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
