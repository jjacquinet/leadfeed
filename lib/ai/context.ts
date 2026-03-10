import { getSupabase } from '@/lib/supabase';

type LeadRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company: string | null;
  linkedin_url: string | null;
  stage: 'lead_feed' | 'snoozed';
  snoozed_until: string | null;
  source: string | null;
  campaign_name: string | null;
  last_activity: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  lead_id: string;
  channel: 'linkedin' | 'email' | 'phone' | 'text';
  direction: 'inbound' | 'outbound';
  content: string;
  is_note: boolean;
  timestamp: string;
};

export type LeadSummary = {
  id: string;
  full_name: string;
  title: string | null;
  company: string | null;
  stage: 'lead_feed' | 'snoozed';
  snoozed_until: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  campaign_name: string | null;
  source: string | null;
  last_activity: string;
  hours_since_activity: number;
};

export type LeadMessageSummary = {
  id: string;
  lead_id: string;
  channel: string;
  direction: string;
  is_note: boolean;
  timestamp: string;
  content: string;
};

export type RankedLead = LeadSummary & {
  score: number;
  reasons: string[];
  recent_inbound_count: number;
  recent_outbound_count: number;
};

function toLeadSummary(row: LeadRow): LeadSummary {
  const now = Date.now();
  const lastActivityTs = new Date(row.last_activity).getTime();
  const hoursSinceActivity = Number.isFinite(lastActivityTs)
    ? Math.max(0, (now - lastActivityTs) / 36e5)
    : 9999;

  return {
    id: row.id,
    full_name: `${row.first_name} ${row.last_name}`.trim(),
    title: row.title,
    company: row.company,
    stage: row.stage,
    snoozed_until: row.snoozed_until,
    email: row.email,
    phone: row.phone,
    linkedin_url: row.linkedin_url,
    campaign_name: row.campaign_name,
    source: row.source,
    last_activity: row.last_activity,
    hours_since_activity: Number(hoursSinceActivity.toFixed(1)),
  };
}

function truncate(text: string, max = 400): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export async function getLeadSummaries(options?: {
  stage?: 'lead_feed' | 'snoozed';
  limit?: number;
}): Promise<LeadSummary[]> {
  const supabase = getSupabase();
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 300);
  let query = supabase
    .from('leads')
    .select('id, first_name, last_name, email, phone, title, company, linkedin_url, stage, snoozed_until, source, campaign_name, last_activity, created_at, updated_at')
    .order('last_activity', { ascending: false })
    .limit(limit);

  if (options?.stage) {
    query = query.eq('stage', options.stage);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch lead summaries: ${error.message}`);
  }

  return ((data || []) as LeadRow[]).map(toLeadSummary);
}

export async function getLeadDetail(leadId: string): Promise<LeadSummary | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('leads')
    .select('id, first_name, last_name, email, phone, title, company, linkedin_url, stage, snoozed_until, source, campaign_name, last_activity, created_at, updated_at')
    .eq('id', leadId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch lead detail: ${error.message}`);
  }

  return toLeadSummary(data as LeadRow);
}

export async function getLeadMessages(leadId: string, limit = 80): Promise<LeadMessageSummary[]> {
  const supabase = getSupabase();
  const boundedLimit = Math.min(Math.max(limit, 1), 200);
  const { data, error } = await supabase
    .from('messages')
    .select('id, lead_id, channel, direction, content, is_note, timestamp')
    .eq('lead_id', leadId)
    .order('timestamp', { ascending: true })
    .limit(boundedLimit);

  if (error) {
    throw new Error(`Failed to fetch lead messages: ${error.message}`);
  }

  return ((data || []) as MessageRow[]).map((message) => ({
    id: message.id,
    lead_id: message.lead_id,
    channel: message.channel,
    direction: message.direction,
    is_note: message.is_note,
    timestamp: message.timestamp,
    content: truncate(message.content || ''),
  }));
}

export async function rankLeads(limit = 10): Promise<RankedLead[]> {
  const supabase = getSupabase();
  const cappedLimit = Math.min(Math.max(limit, 1), 25);
  const { data: leadsData, error: leadError } = await supabase
    .from('leads')
    .select('id, first_name, last_name, email, phone, title, company, linkedin_url, stage, snoozed_until, source, campaign_name, last_activity, created_at, updated_at')
    .order('last_activity', { ascending: false })
    .limit(300);

  if (leadError) {
    throw new Error(`Failed to fetch leads for ranking: ${leadError.message}`);
  }

  const leads = (leadsData || []) as LeadRow[];
  const leadIds = leads.map((lead) => lead.id);

  const { data: messagesData, error: messageError } = await supabase
    .from('messages')
    .select('lead_id, direction, timestamp, is_note')
    .in('lead_id', leadIds)
    .order('timestamp', { ascending: false })
    .limit(3000);

  if (messageError) {
    throw new Error(`Failed to fetch messages for ranking: ${messageError.message}`);
  }

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 36e5;
  const byLead = new Map<string, { inbound: number; outbound: number }>();
  for (const msg of (messagesData || []) as Array<{
    lead_id: string;
    direction: 'inbound' | 'outbound';
    timestamp: string;
    is_note: boolean;
  }>) {
    if (msg.is_note) continue;
    const ts = new Date(msg.timestamp).getTime();
    if (!Number.isFinite(ts) || ts < sevenDaysAgo) continue;
    const current = byLead.get(msg.lead_id) || { inbound: 0, outbound: 0 };
    if (msg.direction === 'inbound') current.inbound += 1;
    if (msg.direction === 'outbound') current.outbound += 1;
    byLead.set(msg.lead_id, current);
  }

  const ranked = leads.map((lead) => {
    const summary = toLeadSummary(lead);
    const messageStats = byLead.get(lead.id) || { inbound: 0, outbound: 0 };
    const reasons: string[] = [];
    let score = 0;

    if (summary.stage === 'lead_feed') {
      score += 35;
      reasons.push('Currently in Lead Feed');
    } else {
      score -= 20;
      reasons.push('Currently snoozed');
    }

    const recencyBoost = Math.max(0, 30 - Math.floor(summary.hours_since_activity / 6));
    score += recencyBoost;
    if (summary.hours_since_activity < 24) reasons.push('Recent activity in last 24 hours');

    score += messageStats.inbound * 18;
    if (messageStats.inbound > 0) reasons.push(`${messageStats.inbound} recent inbound message(s)`);

    score += Math.min(messageStats.outbound * 6, 18);
    if (messageStats.outbound > 0) reasons.push(`${messageStats.outbound} recent outbound touch(es)`);

    if (summary.email) {
      score += 6;
      reasons.push('Has email');
    }
    if (summary.linkedin_url) {
      score += 5;
      reasons.push('Has LinkedIn profile');
    }
    if (summary.company) {
      score += 4;
      reasons.push('Has company context');
    }

    return {
      ...summary,
      score,
      reasons,
      recent_inbound_count: messageStats.inbound,
      recent_outbound_count: messageStats.outbound,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, cappedLimit);
}
