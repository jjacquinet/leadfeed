export type LeadStatus = 'active' | 'snoozed' | 'closed';
export type DealStage = 'lead' | 'conversation' | 'demo_scheduled' | 'proposal_sent' | 'contract_sent';

// Legacy stage values kept for compatibility with older components/routes.
export type LeadStage = 'lead_feed' | 'snoozed';

export type MessageChannel = 'linkedin' | 'email' | 'phone' | 'text' | 'call' | 'note';
export type MessageDirection = 'inbound' | 'outbound' | 'internal';

export type ActivityType =
  | 'email_sent'
  | 'email_received'
  | 'connection_request_sent'
  | 'connection_request_accepted'
  | 'linkedin_sent'
  | 'linkedin_received'
  | 'call'
  | 'text_sent'
  | 'text_received'
  | 'note';

export interface Lead {
  id: string;
  name?: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  phone_numbers?: string[] | null;
  title: string | null;
  company: string | null;
  company_size?: string | null;
  linkedin_url: string | null;
  company_website: string | null;
  location?: string | null;
  avatar_color?: string | null;
  deal_stage?: DealStage | null;
  deal_size?: number | null;
  lead_source?: string | null;
  status?: LeadStatus | null;
  snooze_until?: string | null;
  closed_at?: string | null;
  has_unread?: boolean;
  last_inbound_at?: string | null;
  last_activity_at?: string | null;
  notes?: string | null;
  rep_id?: string | null;
  getsales_uuid: string | null;
  created_at: string;
  updated_at: string;

  // Legacy fields preserved for compatibility
  stage: LeadStage;
  snoozed_until: string | null;
  source: string | null;
  campaign_name: string | null;
  last_activity: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: ActivityType;
  channel: 'email' | 'linkedin' | 'call' | 'text' | 'note';
  direction: MessageDirection;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

// Backward-compatible alias while legacy code is phased out.
export type Message = {
  id: string;
  lead_id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  content: string;
  is_note: boolean;
  timestamp: string;
  created_at: string;
  external_id: string | null;
};

export interface SenderProfile {
  uuid: string;
  first_name: string | null;
  last_name: string | null;
  label: string | null;
  status: string | null;
  mailbox_uuid: string | null;
  from_email?: string | null;
  from_name?: string | null;
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
};

export const STAGE_NAV_ORDER: LeadStage[] = ['lead_feed', 'snoozed'];
