export type LeadStage =
  | 'lead_feed'
  | 'snoozed'
  | 'meeting_booked'
  | 'closed_won'
  | 'closed_lost';

export type MessageChannel = 'linkedin' | 'email' | 'phone' | 'text';

export type MessageDirection = 'inbound' | 'outbound';

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company: string | null;
  linkedin_url: string | null;
  company_website: string | null;
  stage: LeadStage;
  snoozed_until: string | null;
  source: string | null;
  campaign_name: string | null;
  getsales_uuid: string | null;
  created_at: string;
  updated_at: string;
  last_activity: string;
}

export interface Message {
  id: string;
  lead_id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  content: string;
  is_note: boolean;
  timestamp: string;
  created_at: string;
  external_id: string | null;
}

export interface WebhookPayload {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
  company_website?: string;
  campaign_name?: string;
  channel?: MessageChannel;
  messages?: {
    direction: MessageDirection;
    content: string;
    timestamp?: string;
  }[];
}

export const STAGE_LABELS: Record<LeadStage, string> = {
  lead_feed: 'Lead Feed',
  snoozed: 'Snoozed',
  meeting_booked: 'Meeting Booked',
  closed_won: 'Closed — Won',
  closed_lost: 'Closed — Lost',
};

export const STAGE_NAV_ORDER: LeadStage[] = [
  'lead_feed',
  'snoozed',
  'meeting_booked',
  'closed_won',
  'closed_lost',
];
