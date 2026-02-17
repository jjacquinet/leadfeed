import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { WebhookPayload } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.WEBHOOK_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: WebhookPayload = await request.json();

    if (!payload.first_name || !payload.last_name) {
      return NextResponse.json(
        { error: 'Missing required fields: first_name, last_name' },
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
      // Update existing lead
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

      // If lead was snoozed and new message comes in, move back to lead_feed
      if (existingLead.stage === 'snoozed') {
        updates.stage = 'lead_feed';
        updates.snoozed_until = null;
      }

      await supabase.from('leads').update(updates).eq('id', existingLead.id);

      // Add new messages
      if (payload.messages && payload.messages.length > 0) {
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

      return NextResponse.json({
        success: true,
        action: 'updated',
        lead_id: existingLead.id,
      });
    } else {
      // Create new lead
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
        console.error('Error creating lead:', leadError);
        return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
      }

      // Add messages
      if (payload.messages && payload.messages.length > 0) {
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

      return NextResponse.json({
        success: true,
        action: 'created',
        lead_id: newLead.id,
      });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
