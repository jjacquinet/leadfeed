import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { LeadStage } from '@/lib/types';

export async function GET() {
  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, status, stage, snooze_until, snoozed_until');

    if (error) {
      console.error('Error fetching lead counts:', error);
      return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
    }

    const counts: Record<LeadStage, number> = {
      lead_feed: 0,
      snoozed: 0,
    };

    for (const lead of leads || []) {
      const status = lead.status || (lead.stage === 'snoozed' ? 'snoozed' : 'active');
      const snoozeUntil = lead.snooze_until || lead.snoozed_until;
      if (status === 'snoozed' && snoozeUntil) {
        if (new Date(snoozeUntil) <= new Date(now)) {
          counts.lead_feed++;
        } else {
          counts.snoozed++;
        }
      } else if (status === 'active') {
        counts.lead_feed++;
      }
    }

    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
