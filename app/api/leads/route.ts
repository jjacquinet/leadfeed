import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { LeadStage } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage') as LeadStage | null;

    let query = supabase.from('leads').select('*');

    if (stage === 'lead_feed') {
      // Include leads where snooze has expired (auto-promote)
      query = query.or('stage.eq.lead_feed,and(stage.eq.snoozed,snoozed_until.lte.' + new Date().toISOString() + ')');
    } else if (stage) {
      if (stage === 'snoozed') {
        // Only show snoozed leads that haven't expired
        query = query.eq('stage', 'snoozed').gt('snoozed_until', new Date().toISOString());
      } else {
        query = query.eq('stage', stage);
      }
    }

    // Sort based on stage
    if (stage === 'snoozed') {
      query = query.order('snoozed_until', { ascending: true });
    } else if (stage === 'lead_feed') {
      query = query.order('last_activity', { ascending: false });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Auto-promote expired snoozed leads
    if (stage === 'lead_feed' && data) {
      const expiredSnoozed = data.filter(
        (lead) => lead.stage === 'snoozed' && lead.snoozed_until && new Date(lead.snoozed_until) <= new Date()
      );
      for (const lead of expiredSnoozed) {
        await supabase
          .from('leads')
          .update({ stage: 'lead_feed', snoozed_until: null, updated_at: new Date().toISOString() })
          .eq('id', lead.id);
        lead.stage = 'lead_feed';
        lead.snoozed_until = null;
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    if (updates.stage && updates.stage !== 'snoozed') {
      updates.snoozed_until = null;
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead:', error);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
