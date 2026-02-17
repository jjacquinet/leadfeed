import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { LeadStage, STAGE_NAV_ORDER } from '@/lib/types';

export async function GET() {
  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, stage, snoozed_until');

    if (error) {
      console.error('Error fetching lead counts:', error);
      return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
    }

    const counts: Record<LeadStage, number> = {
      lead_feed: 0,
      snoozed: 0,
      meeting_booked: 0,
      closed_won: 0,
      closed_lost: 0,
    };

    for (const lead of leads || []) {
      if (lead.stage === 'snoozed' && lead.snoozed_until) {
        if (new Date(lead.snoozed_until) <= new Date(now)) {
          counts.lead_feed++;
        } else {
          counts.snoozed++;
        }
      } else if (lead.stage in counts) {
        counts[lead.stage as LeadStage]++;
      }
    }

    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
