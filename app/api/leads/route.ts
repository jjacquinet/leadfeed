import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { normalizePhoneNumbers, primaryPhoneFromList } from '@/lib/phones';
import { ensureProspect } from '@/lib/getsales';

type QueueLead = {
  id: string;
  has_unread: boolean | null;
  last_inbound_at: string | null;
  last_activity_at: string | null;
  closed_at: string | null;
  updated_at: string;
};

function sortQueueLeads(leads: QueueLead[]): QueueLead[] {
  return leads.sort((a, b) => {
    const aUnread = Boolean(a.has_unread);
    const bUnread = Boolean(b.has_unread);
    if (aUnread && !bUnread) return -1;
    if (!aUnread && bUnread) return 1;

    if (aUnread && bUnread) {
      const aInbound = a.last_inbound_at ? new Date(a.last_inbound_at).getTime() : 0;
      const bInbound = b.last_inbound_at ? new Date(b.last_inbound_at).getTime() : 0;
      return bInbound - aInbound;
    }

    const aActivity = a.last_activity_at ? new Date(a.last_activity_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bActivity = b.last_activity_at ? new Date(b.last_activity_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aActivity - bActivity;
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const stage = searchParams.get('stage');
    const repliesOnly = searchParams.get('replies') === 'true';
    const now = new Date().toISOString();

    // Promote expired snoozed leads to active for queue correctness.
    await supabase
      .from('leads')
      .update({
        status: 'active',
        stage: 'lead_feed',
        snooze_until: null,
        snoozed_until: null,
        updated_at: now,
      })
      .eq('status', 'snoozed')
      .lte('snooze_until', now);

    let query = supabase.from('leads').select('*');

    // Backward compatibility with older stage query params.
    if (!status && stage === 'lead_feed') {
      query = query.eq('status', 'active');
    } else if (!status && stage === 'snoozed') {
      query = query.eq('status', 'snoozed').gt('snooze_until', now);
    } else if (status === 'active') {
      // Compatibility: include legacy rows that still use stage-only semantics.
      query = query.or('status.eq.active,stage.eq.lead_feed');
    } else if (status === 'snoozed') {
      query = query.or('status.eq.snoozed,stage.eq.snoozed').gt('snooze_until', now);
    } else if (status === 'closed') {
      query = query.eq('status', 'closed');
    }

    let { data, error } = await query;

    // Legacy schema fallback when V1 columns are not yet present in production.
    if (error) {
      const legacyQuery = supabase.from('leads').select('*');
      let legacy = legacyQuery;
      if (!status || status === 'active' || stage === 'lead_feed') {
        legacy = legacy.or(
          'stage.eq.lead_feed,and(stage.eq.snoozed,snoozed_until.lte.' +
            now +
            ')'
        );
      } else if (status === 'snoozed' || stage === 'snoozed') {
        legacy = legacy.eq('stage', 'snoozed').gt('snoozed_until', now);
      } else if (status === 'closed') {
        legacy = legacy.eq('status', 'archived');
      }
      const legacyResult = await legacy;
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    let leads = Array.isArray(data) ? data : [];
    if (repliesOnly) {
      leads = leads.filter((lead) => Boolean(lead.has_unread));
    }

    if (!status || status === 'active' || stage === 'lead_feed') {
      leads = sortQueueLeads(leads as QueueLead[]);
    } else if (status === 'snoozed' || stage === 'snoozed') {
      leads.sort((a, b) => {
        const aAt = a.snooze_until ? new Date(a.snooze_until).getTime() : Number.MAX_SAFE_INTEGER;
        const bAt = b.snooze_until ? new Date(b.snooze_until).getTime() : Number.MAX_SAFE_INTEGER;
        return aAt - bAt;
      });
    } else if (status === 'closed') {
      leads.sort((a, b) => {
        const aClosed = a.closed_at ? new Date(a.closed_at).getTime() : 0;
        const bClosed = b.closed_at ? new Date(b.closed_at).getTime() : 0;
        if (aClosed !== bClosed) return bClosed - aClosed;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    } else {
      leads.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }

    return NextResponse.json(leads);
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

    const now = new Date().toISOString();
    updates.updated_at = now;

    const hasPhoneNumbers = Object.prototype.hasOwnProperty.call(updates, 'phone_numbers');
    const hasPhone = Object.prototype.hasOwnProperty.call(updates, 'phone');

    if (hasPhoneNumbers) {
      updates.phone_numbers = normalizePhoneNumbers(updates.phone_numbers);
      updates.phone = primaryPhoneFromList(updates.phone_numbers);
    } else if (hasPhone) {
      const trimmedPhone =
        typeof updates.phone === 'string' ? updates.phone.trim() : '';
      updates.phone_numbers = normalizePhoneNumbers([trimmedPhone]);
      updates.phone = trimmedPhone || null;
    }

    if (updates.status && updates.status !== 'snoozed') {
      updates.snooze_until = null;
      updates.snoozed_until = null;
    }

    if (updates.snooze_until) {
      updates.status = 'snoozed';
      updates.stage = 'snoozed';
      updates.snoozed_until = updates.snooze_until;
    }

    if (updates.status === 'active') {
      updates.stage = 'lead_feed';
      updates.closed_at = null;
    }
    if (updates.status === 'closed') {
      updates.stage = 'snoozed';
      updates.closed_at = now;
    }

    if (updates.has_unread === false && !Object.prototype.hasOwnProperty.call(updates, 'last_inbound_at')) {
      updates.last_inbound_at = updates.last_inbound_at ?? null;
    }

    if (!Object.prototype.hasOwnProperty.call(updates, 'last_activity_at')) {
      updates.last_activity_at = now;
    }

    if (!Object.prototype.hasOwnProperty.call(updates, 'last_activity')) {
      updates.last_activity = updates.last_activity_at;
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

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
    const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : null;
    const company = typeof body.company === 'string' ? body.company.trim() : null;
    const companyWebsite =
      typeof body.company_website === 'string' ? body.company_website.trim() : null;
    const linkedinUrl =
      typeof body.linkedin_url === 'string' ? body.linkedin_url.trim() : null;
    const email = typeof body.email === 'string' ? body.email.trim() : null;
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: first_name, last_name' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const phoneNumbers = normalizePhoneNumbers(phone ? [phone] : []);

    const newLead = {
      first_name: firstName,
      last_name: lastName,
      name: `${firstName} ${lastName}`.trim(),
      title: title || null,
      company: company || null,
      company_website: companyWebsite || null,
      linkedin_url: linkedinUrl || null,
      email: email || null,
      phone: primaryPhoneFromList(phoneNumbers),
      phone_numbers: phoneNumbers,
      status: 'active',
      has_unread: false,
      stage: 'lead_feed',
      snooze_until: null,
      snoozed_until: null,
      closed_at: null,
      created_at: now,
      updated_at: now,
      last_activity: now,
      last_activity_at: now,
    };

    let { data, error } = await supabase
      .from('leads')
      .insert(newLead)
      .select()
      .single();

    // Legacy fallback for environments missing newer columns.
    if (error) {
      const legacyLead = {
        first_name: firstName,
        last_name: lastName,
        title: title || null,
        company: company || null,
        company_website: companyWebsite || null,
        linkedin_url: linkedinUrl || null,
        email: email || null,
        phone: phone || null,
        stage: 'lead_feed',
        snoozed_until: null,
        created_at: now,
        updated_at: now,
        last_activity: now,
      };

      const legacyResult = await supabase
        .from('leads')
        .insert(legacyLead)
        .select()
        .single();
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
    }

    let getsalesWarning: string | null = null;
    let getsalesProspectId: string | null = null;
    if (process.env.GETSALES_API_KEY) {
      try {
        getsalesProspectId = await ensureProspect({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          linkedin_url: linkedinUrl || null,
          title: title || null,
          company: company || null,
        });

        if (getsalesProspectId && data?.id) {
          const updatePayload: Record<string, unknown> = {
            getsales_prospect_id: getsalesProspectId,
            updated_at: now,
          };
          if (!data.getsales_uuid) {
            updatePayload.getsales_uuid = getsalesProspectId;
          }
          await supabase.from('leads').update(updatePayload).eq('id', data.id);
          data = {
            ...data,
            getsales_prospect_id: getsalesProspectId,
            getsales_uuid: data.getsales_uuid || getsalesProspectId,
          };
        } else {
          getsalesWarning =
            'Lead saved, but could not find or create a matching prospect in GetSales.';
        }
      } catch (error) {
        console.error('Error syncing lead to GetSales:', error);
        getsalesWarning = 'Lead saved, but GetSales sync failed.';
      }
    } else {
      getsalesWarning = 'Lead saved, but GETSALES_API_KEY is not configured.';
    }

    return NextResponse.json(
      {
        ...data,
        getsales_sync_warning: getsalesWarning,
        getsales_prospect_id: data?.getsales_prospect_id || getsalesProspectId || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
