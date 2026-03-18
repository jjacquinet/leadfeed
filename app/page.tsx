'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Lead } from '@/lib/types';
import ChannelIcon from '@/components/ui/ChannelIcon';
import { cleanEmailReplyContent } from '@/lib/utils';
import { MAX_PHONE_NUMBERS, normalizePhoneNumbers } from '@/lib/phones';

type FeedTab = 'today' | 'snoozed' | 'closed';
type ComposeChannel = 'email' | 'call' | 'linkedin' | 'text' | 'note';
type EmailComposeMode = 'reply' | 'new';

type SenderProfileOption = {
  uuid: string;
  first_name?: string | null;
  last_name?: string | null;
  label?: string | null;
  from_name?: string | null;
  from_email?: string | null;
  linkedin_account_uuid?: string | null;
  linkedin_identity?: string | null;
  linkedin_profile_url?: string | null;
};

type ComposeAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentBase64: string;
};

type EmailThreadOption = {
  id: string;
  subject: string;
  latestAt: string;
  senderProfileUuid?: string | null;
  threadId?: string | null;
  emailUuid?: string | null;
};

type AddLeadForm = {
  first_name: string;
  last_name: string;
  title: string;
  company: string;
  company_website: string;
  linkedin_url: string;
  email: string;
  phone: string;
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  conversation: 'Conversation',
  demo_scheduled: 'Demo Scheduled',
  proposal_sent: 'Proposal Sent',
  contract_sent: 'Contract Sent',
};

const SNOOZE_OPTIONS: Array<{ label: string; days: number }> = [
  { label: 'Tomorrow', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
];

function fullName(lead: Lead): string {
  if (lead.name) return lead.name;
  return `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown Lead';
}

function fmtRelative(iso?: string | null): string {
  if (!iso) return 'Never';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'Unknown';
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function addDays(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString();
}

function eventLabel(activity: Activity): string {
  const map: Record<string, string> = {
    email_sent: 'You sent email',
    email_received: 'Received email',
    connection_request_sent: 'Connection request sent',
    connection_request_accepted: 'Connection request accepted',
    linkedin_sent: 'You sent LinkedIn',
    linkedin_received: 'Received LinkedIn',
    call: 'Call',
    text_sent: 'Text sent',
    text_received: 'Text received',
    note: 'Note',
  };
  return map[activity.type] || activity.type;
}

function bubbleClass(activity: Activity): string {
  if (activity.type === 'note' || activity.channel === 'note') {
    return 'bg-amber-100 border border-amber-200 text-slate-800';
  }
  if (activity.direction === 'inbound') return 'bg-white border border-slate-200 text-slate-700';
  if (activity.type.startsWith('email')) return 'bg-indigo-50 border border-indigo-100 text-slate-700';
  if (activity.type.startsWith('linkedin') || activity.type.startsWith('connection_request') || activity.channel === 'linkedin') return 'bg-blue-50 border border-blue-100 text-slate-700';
  if (activity.type.startsWith('text')) return 'bg-violet-50 border border-violet-100 text-slate-700';
  if (activity.type === 'call') return 'bg-amber-50 border border-amber-100 text-slate-700';
  return 'bg-slate-50 border border-slate-200 text-slate-700';
}

function isRawWebhookPayload(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith('[Raw webhook payload]') ||
    trimmed.includes('"event_name"') ||
    trimmed.includes('"getsales_url"')
  );
}

function getDisplayContent(activity: Activity): string {
  if (activity.channel === 'email') {
    const cleaned = cleanEmailReplyContent(activity.content || '');
    return cleaned.cleanedContent || activity.content;
  }
  return activity.content;
}

function formatResurfaceLabel(iso?: string | null): string {
  if (!iso) return 'Resurface date not set';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Resurface date unknown';

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startTarget.getTime() - startToday.getTime()) / 86400000);

  if (diffDays === 0) return 'Resurfaces today';
  if (diffDays === 1) return 'Resurfaces tomorrow';

  const sameYear = date.getFullYear() === today.getFullYear();
  const formatted = date.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
  return `Resurfaces ${formatted}`;
}

function formatClosedDate(iso?: string | null): string {
  if (!iso) return 'Closed date unknown';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Closed date unknown';
  return `Closed ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function toTelHref(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const hasLeadingPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return null;
  return `tel:${hasLeadingPlus ? '+' : ''}${digitsOnly}`;
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractEmailSubject(content: string): string | null {
  const match = content.match(/^\*\*(.+?)\*\*(?:\n|$)/);
  if (!match) return null;
  return match[1].trim() || null;
}

function ensureReplySubject(subject: string): string {
  if (!subject.trim()) return '';
  if (/^re:\s*/i.test(subject)) return subject.trim();
  return `Re: ${subject.trim()}`;
}

function normalizeThreadKey(subject: string): string {
  return subject.trim().replace(/^re:\s*/i, '').toLowerCase();
}

function senderProfileLabel(profile: SenderProfileOption): string {
  const name =
    profile.from_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
    profile.label ||
    'Sender';
  const email = profile.from_email || 'no-email';
  return `${name} (${email})`;
}

function linkedInSenderProfileLabel(profile: SenderProfileOption): string {
  const name =
    profile.from_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
    profile.label ||
    'Sender';
  const identity =
    profile.linkedin_identity ||
    (typeof profile.linkedin_profile_url === 'string'
      ? profile.linkedin_profile_url.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] || null
      : null) ||
    'LinkedIn';
  return `${name} (${identity})`;
}

function getMostRecentNote(activities: Activity[]): string | null {
  for (let i = activities.length - 1; i >= 0; i -= 1) {
    const activity = activities[i];
    if (activity.type === 'note' || activity.channel === 'note') {
      return activity.content?.trim() || null;
    }
  }
  return null;
}

export default function HomePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [snoozedLeads, setSnoozedLeads] = useState<Lead[]>([]);
  const [closedLeads, setClosedLeads] = useState<Lead[]>([]);
  const [activitiesByLead, setActivitiesByLead] = useState<Record<string, Activity[]>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [tab, setTab] = useState<FeedTab>('today');
  const [composeChannel, setComposeChannel] = useState<ComposeChannel>('email');
  const [composeText, setComposeText] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [showSnoozeBar, setShowSnoozeBar] = useState(false);
  const [snoozedCount, setSnoozedCount] = useState(0);
  const [closedCount, setClosedCount] = useState(0);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [addingLead, setAddingLead] = useState(false);
  const [enrichingAddLead, setEnrichingAddLead] = useState(false);
  const [addLeadEnrichMessage, setAddLeadEnrichMessage] = useState('');
  const [addLeadForm, setAddLeadForm] = useState<AddLeadForm>({
    first_name: '',
    last_name: '',
    title: '',
    company: '',
    company_website: '',
    linkedin_url: '',
    email: '',
    phone: '',
  });
  const [emailComposeMode, setEmailComposeMode] = useState<EmailComposeMode>('reply');
  const [selectedEmailThreadId, setSelectedEmailThreadId] = useState<string>('');
  const [senderProfiles, setSenderProfiles] = useState<SenderProfileOption[]>([]);
  const [selectedSenderProfileUuid, setSelectedSenderProfileUuid] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailAttachments, setEmailAttachments] = useState<ComposeAttachment[]>([]);
  const [loadingSenderProfiles, setLoadingSenderProfiles] = useState(false);
  const [linkedInSenderProfiles, setLinkedInSenderProfiles] = useState<SenderProfileOption[]>([]);
  const [selectedLinkedInSenderProfileUuid, setSelectedLinkedInSenderProfileUuid] = useState<string>('');
  const [loadingLinkedInSenderProfiles, setLoadingLinkedInSenderProfiles] = useState(false);
  const [editingPhoneIndex, setEditingPhoneIndex] = useState<number | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [enrichingPhone, setEnrichingPhone] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState(false);
  const [websiteInput, setWebsiteInput] = useState('');
  const [savingWebsite, setSavingWebsite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(260);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const allLeads = useMemo(() => {
    const map = new Map<string, Lead>();
    [...leads, ...snoozedLeads, ...closedLeads].forEach((lead) => {
      map.set(lead.id, lead);
    });
    return Array.from(map.values());
  }, [leads, snoozedLeads, closedLeads]);

  const selectedLead = useMemo(
    () => allLeads.find((lead) => lead.id === selectedLeadId) ?? null,
    [allLeads, selectedLeadId]
  );
  const selectedLeadStatus = selectedLead?.status as string | undefined;
  const selectedLeadClosed = selectedLeadStatus === 'closed' || selectedLeadStatus === 'archived';
  const selectedLeadPhoneNumbers = useMemo(() => {
    if (!selectedLead) return [];
    return normalizePhoneNumbers([
      ...(Array.isArray(selectedLead.phone_numbers) ? selectedLead.phone_numbers : []),
      selectedLead.phone,
    ]);
  }, [selectedLead]);
  const selectedActivities = useMemo(() => {
    const activities = selectedLeadId ? activitiesByLead[selectedLeadId] || [] : [];
    return activities.filter((activity) => !isRawWebhookPayload(activity.content));
  }, [selectedLeadId, activitiesByLead]);
  const emailThreads = useMemo(() => {
    const emailActivities = selectedActivities
      .filter((activity) => activity.channel === 'email')
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const map = new Map<string, EmailThreadOption>();
    for (const activity of emailActivities) {
      const metadata = (activity.metadata || {}) as Record<string, unknown>;
      const subject = extractEmailSubject(activity.content) || 'No subject';
      const threadIdFromMetadata =
        (typeof metadata.thread_id === 'string' && metadata.thread_id) ||
        (typeof metadata.thread_uuid === 'string' && metadata.thread_uuid) ||
        (typeof metadata.email_thread_uuid === 'string' && metadata.email_thread_uuid) ||
        null;
      const threadKey = threadIdFromMetadata || `subject:${normalizeThreadKey(subject)}`;
      if (!map.has(threadKey)) {
        map.set(threadKey, {
          id: threadKey,
          subject,
          latestAt: activity.created_at,
          senderProfileUuid:
            typeof metadata.sender_profile_uuid === 'string' ? metadata.sender_profile_uuid : null,
          threadId: threadIdFromMetadata,
          emailUuid:
            typeof metadata.email_uuid === 'string'
              ? metadata.email_uuid
              : typeof metadata.external_id === 'string'
                ? metadata.external_id.replace(/^gs_em_/, '')
                : null,
        });
      } else {
        const existing = map.get(threadKey)!;
        if (
          !existing.senderProfileUuid &&
          typeof metadata.sender_profile_uuid === 'string' &&
          metadata.sender_profile_uuid
        ) {
          existing.senderProfileUuid = metadata.sender_profile_uuid;
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
    );
  }, [selectedActivities]);
  const preferredLinkedInSenderProfileUuid = useMemo(() => {
    const outboundLinkedInActivities = selectedActivities.filter(
      (activity) =>
        activity.direction === 'outbound' &&
        (activity.channel === 'linkedin' ||
          activity.type === 'linkedin_sent' ||
          activity.type === 'connection_request_sent')
    );
    for (const activity of outboundLinkedInActivities) {
      const metadata = (activity.metadata || {}) as Record<string, unknown>;
      if (typeof metadata.sender_profile_uuid === 'string' && metadata.sender_profile_uuid) {
        return metadata.sender_profile_uuid;
      }
    }
    return null;
  }, [selectedActivities]);

  const loadLeads = useCallback(async () => {
    const [activeRes, snoozedRes, closedRes] = await Promise.all([
      fetch('/api/leads?status=active'),
      fetch('/api/leads?status=snoozed'),
      fetch('/api/leads?status=closed'),
    ]);
    const [activeData, snoozedData, closedData] = await Promise.all([
      activeRes.json(),
      snoozedRes.json(),
      closedRes.json(),
    ]);
    const fetchedLeads = Array.isArray(activeData) ? activeData : [];
    const fetchedSnoozedLeads = Array.isArray(snoozedData) ? snoozedData : [];
    const fetchedClosedLeads = Array.isArray(closedData) ? closedData : [];
    setLeads(fetchedLeads);
    setSnoozedLeads(fetchedSnoozedLeads);
    setClosedLeads(fetchedClosedLeads);
    setSnoozedCount(fetchedSnoozedLeads.length);
    setClosedCount(fetchedClosedLeads.length);

    const allFetched = [...fetchedLeads, ...fetchedSnoozedLeads, ...fetchedClosedLeads];
    if (!selectedLeadId && fetchedLeads.length > 0) {
      setSelectedLeadId(fetchedLeads[0].id);
    } else if (selectedLeadId && !allFetched.some((lead: Lead) => lead.id === selectedLeadId)) {
      setSelectedLeadId(fetchedLeads[0]?.id || allFetched[0]?.id || null);
    }
  }, [selectedLeadId]);

  const loadActivities = useCallback(async (leadId: string) => {
    const response = await fetch(`/api/activities?lead_id=${leadId}`);
    const data = await response.json();
    if (Array.isArray(data)) {
      setActivitiesByLead((prev) => ({ ...prev, [leadId]: data }));
    }
  }, []);

  const syncAndLoadActivities = useCallback(async (leadId: string) => {
    try {
      await fetch(`/api/leads/sync?lead_id=${leadId}`, { method: 'POST' });
    } catch {
      // Non-blocking: still load whatever exists locally.
    }
    await loadActivities(leadId);
  }, [loadActivities]);

  useEffect(() => {
    (async () => {
      try {
        await loadLeads();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLeads]);

  useEffect(() => {
    if (!selectedLeadId) return;
    syncAndLoadActivities(selectedLeadId);
  }, [selectedLeadId, syncAndLoadActivities]);

  useEffect(() => {
    setEditingPhoneIndex(null);
    setPhoneInput('');
    setSavingPhone(false);
    setEnrichingPhone(false);
    setEditingWebsite(false);
    setWebsiteInput('');
    setSavingWebsite(false);
    setEmailComposeMode('reply');
    setSelectedEmailThreadId('');
    setSelectedSenderProfileUuid('');
    setSelectedLinkedInSenderProfileUuid('');
    setEmailSubject('');
    setEmailAttachments([]);
  }, [selectedLeadId]);

  useEffect(() => {
    if (composeChannel !== 'email') return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingSenderProfiles(true);
        const response = await fetch('/api/getsales/sender-profiles');
        const data = await response.json().catch(() => []);
        if (cancelled) return;
        const profiles = Array.isArray(data) ? (data as SenderProfileOption[]) : [];
        setSenderProfiles(profiles);
      } catch {
        if (!cancelled) setSenderProfiles([]);
      } finally {
        if (!cancelled) setLoadingSenderProfiles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [composeChannel, selectedLeadId]);

  useEffect(() => {
    if (composeChannel !== 'linkedin') return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingLinkedInSenderProfiles(true);
        const response = await fetch('/api/getsales/sender-profiles?channel=linkedin');
        const data = await response.json().catch(() => []);
        if (cancelled) return;
        const profiles = Array.isArray(data) ? (data as SenderProfileOption[]) : [];
        setLinkedInSenderProfiles(profiles);
      } catch {
        if (!cancelled) setLinkedInSenderProfiles([]);
      } finally {
        if (!cancelled) setLoadingLinkedInSenderProfiles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [composeChannel, selectedLeadId]);

  useEffect(() => {
    if (composeChannel !== 'email') return;
    if (emailComposeMode === 'reply' && emailThreads.length === 0) {
      setEmailComposeMode('new');
      setSelectedEmailThreadId('');
      setEmailSubject('');
      return;
    }
    if (emailComposeMode === 'reply' && emailThreads.length > 0) {
      const current = emailThreads.find((thread) => thread.id === selectedEmailThreadId) || emailThreads[0];
      if (selectedEmailThreadId !== current.id) {
        setSelectedEmailThreadId(current.id);
        setEmailSubject(ensureReplySubject(current.subject));
      } else if (!emailSubject) {
        setEmailSubject(ensureReplySubject(current.subject));
      }
      if (!selectedSenderProfileUuid) {
        setSelectedSenderProfileUuid(current.senderProfileUuid || senderProfiles[0]?.uuid || '');
      }
    } else if (emailComposeMode === 'new') {
      if (!selectedSenderProfileUuid && senderProfiles.length > 0) {
        setSelectedSenderProfileUuid(senderProfiles[0].uuid);
      }
    }
  }, [
    composeChannel,
    emailComposeMode,
    emailThreads,
    selectedEmailThreadId,
    senderProfiles,
    selectedSenderProfileUuid,
    emailSubject,
  ]);

  useEffect(() => {
    if (composeChannel !== 'linkedin') return;
    if (linkedInSenderProfiles.length === 0) return;
    if (selectedLinkedInSenderProfileUuid) return;

    const preferred = preferredLinkedInSenderProfileUuid;
    const preferredIsAvailable = preferred
      ? linkedInSenderProfiles.some((profile) => profile.uuid === preferred)
      : false;
    setSelectedLinkedInSenderProfileUuid(
      preferredIsAvailable ? (preferred as string) : linkedInSenderProfiles[0].uuid
    );
  }, [
    composeChannel,
    linkedInSenderProfiles,
    preferredLinkedInSenderProfileUuid,
    selectedLinkedInSenderProfileUuid,
  ]);

  useEffect(() => {
    const enrichLeads = tab === 'snoozed' ? snoozedLeads : tab === 'closed' ? closedLeads : [];
    if (enrichLeads.length === 0) return;
    const missingActivityLeadIds = enrichLeads
      .map((lead) => lead.id)
      .filter((leadId) => !activitiesByLead[leadId]);
    if (missingActivityLeadIds.length === 0) return;
    Promise.all(missingActivityLeadIds.map((leadId) => loadActivities(leadId))).catch(() => {
      // Non-blocking enrichment for note previews.
    });
  }, [tab, snoozedLeads, closedLeads, activitiesByLead, loadActivities]);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'smooth' });
  }, [selectedLeadId, selectedActivities.length]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (dragging === 'left') {
        const w = Math.min(Math.max(event.clientX - rect.left, 200), 500);
        setLeftWidth(w);
      } else {
        const w = Math.min(Math.max(rect.right - event.clientX, 200), 450);
        setRightWidth(w);
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const queueLeads = useMemo(() => {
    if (tab === 'snoozed') return snoozedLeads;
    if (tab === 'closed') return closedLeads;
    return leads;
  }, [leads, snoozedLeads, closedLeads, tab]);

  const needsReplyCount = useMemo(
    () => leads.filter((lead) => Boolean(lead.has_unread)).length,
    [leads]
  );

  const selectLead = async (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setComposeChannel('email');
    setComposeText('');
    setShowSnoozeBar(false);
    if (lead.has_unread) {
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, has_unread: false }),
      });
      setLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, has_unread: false } : item)));
    }
  };

  const refreshQueue = async () => {
    setRefreshing(true);
    try {
      await loadLeads();
      if (selectedLeadId) {
        await syncAndLoadActivities(selectedLeadId);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const completeTask = () => {
    setShowSnoozeBar(true);
    setComposeText('');
    setCallNotes('');
  };

  const addAttachments = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const readFile = (file: File) =>
      new Promise<ComposeAttachment>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          const contentBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
          resolve({
            id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
            contentBase64,
          });
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

    const next = await Promise.all(Array.from(files).map(readFile));
    setEmailAttachments((prev) => [...prev, ...next]);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const sendCompose = async () => {
    if (!selectedLead || !selectedLeadId) return;

    if (composeChannel === 'call') return;
    if (!composeText.trim()) return;

    if (composeChannel === 'email' || composeChannel === 'linkedin') {
      const senderProfilesEndpoint =
        composeChannel === 'linkedin'
          ? '/api/getsales/sender-profiles?channel=linkedin'
          : '/api/getsales/sender-profiles';
      let availableProfiles = composeChannel === 'linkedin' ? linkedInSenderProfiles : senderProfiles;
      if (availableProfiles.length === 0) {
        const senderProfilesRes = await fetch(senderProfilesEndpoint);
        const senderProfilesData = await senderProfilesRes.json().catch(() => []);
        if (Array.isArray(senderProfilesData)) {
          availableProfiles = senderProfilesData as SenderProfileOption[];
          if (composeChannel === 'linkedin') {
            setLinkedInSenderProfiles(availableProfiles);
          } else {
            setSenderProfiles(availableProfiles);
          }
        }
      }
      const fallbackSenderUuid = availableProfiles.length > 0 ? availableProfiles[0]?.uuid : null;
      const senderProfileUuid =
        composeChannel === 'linkedin'
          ? selectedLinkedInSenderProfileUuid || fallbackSenderUuid
          : selectedSenderProfileUuid || fallbackSenderUuid;
      if (!senderProfileUuid) {
        alert('No sender profile available for sending.');
        return;
      }

      const selectedThread =
        emailThreads.find((thread) => thread.id === selectedEmailThreadId) || emailThreads[0] || null;
      const selectedSender = availableProfiles.find((profile) => profile.uuid === senderProfileUuid) || null;
      const resolvedEmailSubject =
        emailComposeMode === 'reply'
          ? ensureReplySubject(selectedThread?.subject || emailSubject || 'Quick follow-up')
          : (emailSubject.trim() || 'Quick follow-up');

      const sendResponse = await fetch('/api/messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadId,
          channel: composeChannel,
          sender_profile_uuid: senderProfileUuid,
          content: composeText.trim(),
          email_mode: composeChannel === 'email' ? emailComposeMode : undefined,
          subject: composeChannel === 'email' ? resolvedEmailSubject : undefined,
          thread_id: composeChannel === 'email' ? selectedThread?.threadId : undefined,
          reply_to_email_uuid: composeChannel === 'email' ? selectedThread?.emailUuid : undefined,
          from_name: composeChannel === 'email' ? selectedSender?.from_name : undefined,
          from_email: composeChannel === 'email' ? selectedSender?.from_email : undefined,
          attachments:
            composeChannel === 'email'
              ? emailAttachments.map((attachment) => ({
                  filename: attachment.filename,
                  content_type: attachment.contentType,
                  content_base64: attachment.contentBase64,
                  size: attachment.size,
                }))
              : undefined,
        }),
      });
      if (!sendResponse.ok) {
        const errorPayload = await sendResponse.json().catch(() => ({}));
        const message =
          typeof errorPayload?.message === 'string'
            ? errorPayload.message
            : typeof errorPayload?.error === 'string'
              ? errorPayload.error
              : 'Failed to send message';
        alert(message);
        return;
      }
    } else {
      const type = composeChannel === 'text' ? 'text_sent' : 'note';
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadId,
          type,
          content: composeText.trim(),
        }),
      });
    }

    await Promise.all([syncAndLoadActivities(selectedLeadId), loadLeads()]);
    if (composeChannel === 'email') {
      setEmailAttachments([]);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      if (emailComposeMode === 'new') {
        setEmailSubject('');
      }
    }
    completeTask();
  };

  const logCall = async (outcome: string) => {
    if (!selectedLeadId) return;
    await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: selectedLeadId,
        type: 'call',
        content: `${outcome}${callNotes ? `\n\n${callNotes}` : ''}`,
        metadata: { outcome },
      }),
    });
    await Promise.all([syncAndLoadActivities(selectedLeadId), loadLeads()]);
    completeTask();
  };

  const snoozeLead = async (days: number) => {
    if (!selectedLeadId) return;
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedLeadId,
        status: 'snoozed',
        snooze_until: addDays(days),
      }),
    });
    const next = leads.find((lead) => lead.id !== selectedLeadId);
    setShowSnoozeBar(false);
    await loadLeads();
    if (next) setSelectedLeadId(next.id);
  };

  const closeLead = async () => {
    if (!selectedLeadId) return;
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedLeadId,
        status: 'closed',
      }),
    });
    setShowCloseModal(false);
    await loadLeads();
  };

  const wakeLead = async (leadId: string) => {
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: leadId,
        status: 'active',
        snooze_until: null,
      }),
    });
    await loadLeads();
    setTab('today');
    setSelectedLeadId(leadId);
  };

  const reopenLead = async (leadId: string) => {
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: leadId,
        status: 'active',
        snooze_until: null,
      }),
    });
    await loadLeads();
    setTab('today');
    setSelectedLeadId(leadId);
  };

  const updateLeadPhoneNumbers = async (leadId: string, phoneNumbers: string[]) => {
    const response = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, phone_numbers: phoneNumbers }),
    });
    if (!response.ok) {
      throw new Error('Failed to update phone numbers');
    }
    await loadLeads();
  };

  const updateLeadWebsite = async (leadId: string, website: string | null) => {
    const response = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, company_website: website }),
    });
    if (!response.ok) {
      throw new Error('Failed to update website');
    }
    await loadLeads();
  };

  const savePhoneEdit = async (index: number) => {
    if (!selectedLead || savingPhone) return;
    const trimmedPhone = phoneInput.trim();
    if (!trimmedPhone) return;

    try {
      setSavingPhone(true);
      const next = [...selectedLeadPhoneNumbers];
      if (index >= next.length) {
        next.push(trimmedPhone);
      } else {
        next[index] = trimmedPhone;
      }
      await updateLeadPhoneNumbers(selectedLead.id, next);
      setEditingPhoneIndex(null);
      setPhoneInput('');
    } catch (error) {
      console.error('Failed to save phone number:', error);
      alert('Failed to save phone number.');
    } finally {
      setSavingPhone(false);
    }
  };

  const deletePhone = async (index: number) => {
    if (!selectedLead || savingPhone) return;
    try {
      setSavingPhone(true);
      const next = selectedLeadPhoneNumbers.filter((_, phoneIndex) => phoneIndex !== index);
      await updateLeadPhoneNumbers(selectedLead.id, next);
      if (editingPhoneIndex === index) {
        setEditingPhoneIndex(null);
        setPhoneInput('');
      }
    } catch (error) {
      console.error('Failed to delete phone number:', error);
      alert('Failed to delete phone number.');
    } finally {
      setSavingPhone(false);
    }
  };

  const enrichPhonesFromApollo = async () => {
    if (!selectedLead || enrichingPhone) return;
    try {
      setEnrichingPhone(true);
      const response = await fetch('/api/leads/enrich-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedLead.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Enrichment failed');
      }
      await loadLeads();
    } catch (error) {
      console.error('Failed to enrich phone numbers:', error);
      alert(error instanceof Error ? error.message : 'Failed to enrich phone numbers.');
    } finally {
      setEnrichingPhone(false);
    }
  };

  const saveWebsite = async () => {
    if (!selectedLead || savingWebsite) return;
    const normalized = normalizeUrl(websiteInput);
    if (!normalized) return;
    try {
      setSavingWebsite(true);
      await updateLeadWebsite(selectedLead.id, normalized);
      setEditingWebsite(false);
      setWebsiteInput('');
    } catch (error) {
      console.error('Failed to save website:', error);
      alert('Failed to save website.');
    } finally {
      setSavingWebsite(false);
    }
  };

  const resetAddLeadForm = () => {
    setAddLeadForm({
      first_name: '',
      last_name: '',
      title: '',
      company: '',
      company_website: '',
      linkedin_url: '',
      email: '',
      phone: '',
    });
    setAddLeadEnrichMessage('');
  };

  const enrichAddLeadFromLinkedIn = async () => {
    const linkedinUrl = addLeadForm.linkedin_url.trim();
    if (!linkedinUrl || enrichingAddLead) return;
    try {
      setEnrichingAddLead(true);
      setAddLeadEnrichMessage('');
      const response = await fetch('/api/leads/enrich-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin_url: linkedinUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' ? payload.error : 'Failed to enrich from Apollo';
        alert(message);
        return;
      }

      if (!payload?.matched || !payload?.data) {
        setAddLeadForm((prev) => ({
          ...prev,
          first_name: '',
          last_name: '',
          title: '',
          company: '',
          company_website: '',
          email: '',
          phone: '',
        }));
        setAddLeadEnrichMessage('No match found — add details manually');
        return;
      }

      setAddLeadForm((prev) => ({
        ...prev,
        first_name: payload.data.first_name || prev.first_name,
        last_name: payload.data.last_name || prev.last_name,
        title: payload.data.title || prev.title,
        company: payload.data.company || prev.company,
        company_website: payload.data.company_website || prev.company_website,
        email: payload.data.email || prev.email,
        phone: payload.data.phone || prev.phone,
      }));
      setAddLeadEnrichMessage('Details enriched from Apollo');
    } catch (error) {
      console.error('Failed to enrich lead from LinkedIn:', error);
      alert('Failed to enrich from Apollo.');
    } finally {
      setEnrichingAddLead(false);
    }
  };

  const submitAddLead = async () => {
    const firstName = addLeadForm.first_name.trim();
    const lastName = addLeadForm.last_name.trim();
    if (!firstName || !lastName || addingLead) return;

    try {
      setAddingLead(true);
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addLeadForm,
          first_name: firstName,
          last_name: lastName,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' ? payload.error : 'Failed to create lead';
        alert(message);
        return;
      }

      await loadLeads();
      setShowAddLeadModal(false);
      resetAddLeadForm();
      setTab('today');
      if (payload?.id) {
        setSelectedLeadId(payload.id as string);
      }
      setComposeChannel('email');
      setComposeText('');
      setShowSnoozeBar(false);
    } catch (error) {
      console.error('Failed to create lead:', error);
      alert('Failed to create lead.');
    } finally {
      setAddingLead(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading Daily Lead Feed...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-5 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Daily Lead Feed</h1>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString()} · Prioritized at {new Date().toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-700"><strong>{leads.length}</strong> Tasks</span>
            <span className="text-indigo-600"><strong>{needsReplyCount}</strong> Needs Reply</span>
            <span className="text-rose-600"><strong>{closedCount}</strong> Closed</span>
            <span className="text-slate-500"><strong>{snoozedCount}</strong> Snoozed</span>
            <button
              onClick={refreshQueue}
              className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              Add Lead
            </button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 flex min-h-0">
        <div className="bg-white border-r border-slate-200 flex flex-col min-h-0" style={{ width: leftWidth }}>
          <div className="px-3 py-2 border-b border-slate-100 flex gap-2">
            {(['today', 'snoozed', 'closed'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`px-2.5 py-1 text-xs rounded-md ${
                  tab === item ? 'bg-slate-100 text-slate-800 font-medium' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {item === 'today'
                  ? 'Today'
                  : item === 'snoozed'
                    ? `Snoozed (${snoozedCount})`
                    : `Closed (${closedCount})`}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {queueLeads.map((lead) => {
              const selected = lead.id === selectedLeadId;
              if (tab === 'snoozed') {
                const leadActivities = activitiesByLead[lead.id] || [];
                const recentNote = getMostRecentNote(leadActivities);
                return (
                  <div
                    key={lead.id}
                    className={`w-full text-left p-3 border-b border-slate-100 ${
                      selected ? 'bg-slate-50 border-l-2 border-l-slate-800' : ''
                    }`}
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <button
                        onClick={() => selectLead(lead)}
                        className="min-w-0 text-left flex-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-900 truncate">{fullName(lead)}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {lead.title || 'Unknown title'} · {lead.company || 'Unknown company'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatResurfaceLabel(lead.snooze_until || lead.snoozed_until)}
                        </p>
                        {recentNote && (
                          <p className="text-xs text-slate-500 truncate mt-1">Note: {recentNote}</p>
                        )}
                      </button>
                      <button
                        onClick={() => wakeLead(lead.id)}
                        className="px-2.5 py-1 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0"
                      >
                        Wake
                      </button>
                    </div>
                  </div>
                );
              }
              if (tab === 'closed') {
                return (
                  <div
                    key={lead.id}
                    className={`w-full text-left p-3 border-b border-slate-100 ${
                      selected ? 'bg-slate-50 border-l-2 border-l-slate-800' : ''
                    }`}
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <button
                        onClick={() => selectLead(lead)}
                        className="min-w-0 text-left flex-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-900 truncate">{fullName(lead)}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {lead.title || 'Unknown title'} · {lead.company || 'Unknown company'}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-1">
                          Stage: {STAGE_LABELS[lead.deal_stage || 'lead'] || 'Lead'} · Deal: {lead.deal_size ? `$${Number(lead.deal_size).toLocaleString()}` : '—'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatClosedDate(lead.closed_at || lead.updated_at)}
                        </p>
                      </button>
                      <button
                        onClick={() => reopenLead(lead.id)}
                        className="px-2.5 py-1 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0"
                      >
                        Reopen
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={lead.id}
                  onClick={() => selectLead(lead)}
                  className={`w-full text-left p-3 border-b border-slate-100 ${
                    selected ? 'bg-slate-50 border-l-2 border-l-slate-800' : ''
                  }`}
                >
                  <div className="flex justify-between gap-2 items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-900 truncate">{fullName(lead)}</span>
                        {lead.has_unread && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {lead.title || 'Unknown title'} · {lead.company || 'Unknown company'}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-1">
                        ✦ {lead.has_unread ? 'Respond to reply' : 'Follow up'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-slate-500">{STAGE_LABELS[lead.deal_stage || 'lead'] || 'Lead'}</p>
                      <p className="text-[11px] text-slate-400">{fmtRelative(lead.last_activity_at || lead.last_activity)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          onMouseDown={() => setDragging('left')}
          className="w-1 cursor-col-resize bg-transparent hover:bg-slate-300 transition-colors"
        />

        <div className="flex-1 min-w-0 flex flex-col bg-slate-50">
          {selectedLead ? (
            <>
              <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{fullName(selectedLead)}</h2>
                  <p className="text-xs text-slate-500">{selectedLead.title || 'Unknown title'} at {selectedLead.company || 'Unknown company'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedLeadClosed ? (
                    <span className="px-2.5 py-1 text-xs rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                      Closed (view only)
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowSnoozeBar(true)}
                        className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        Snooze
                      </button>
                      <button
                        onClick={() => setShowCloseModal(true)}
                        className="px-3 py-1.5 text-xs rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        Close Lead
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div ref={timelineRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`flex ${activity.direction === 'outbound' || activity.type === 'note' || activity.channel === 'note' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[80%]">
                      <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1.5">
                        <ChannelIcon channel={activity.channel} className="w-3.5 h-3.5" />
                        <span>{eventLabel(activity)} · {fmtRelative(activity.created_at)}</span>
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${bubbleClass(activity)}`}>
                        {getDisplayContent(activity)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {showSnoozeBar && (
                <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-200 flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-emerald-700 font-medium">Next step: Snooze</span>
                  {SNOOZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => snoozeLead(opt.days)}
                      className="px-2 py-1 text-xs rounded border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {!selectedLeadClosed && (
                <div className="bg-white border-t border-slate-200">
                <div className="flex border-b border-slate-100">
                  {(['email', 'call', 'linkedin', 'text', 'note'] as ComposeChannel[]).map((channel) => (
                    <button
                      key={channel}
                      onClick={() => setComposeChannel(channel)}
                      className={`px-3 py-2 text-xs ${
                        composeChannel === channel
                          ? 'text-slate-900 border-b-2 border-slate-900 font-medium'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {channel[0].toUpperCase() + channel.slice(1)}
                    </button>
                  ))}
                </div>

                {composeChannel === 'call' ? (
                  <div className="p-3 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {['Connected', 'Voicemail', 'No Answer', 'Meeting Booked'].map((outcome) => (
                        <button
                          key={outcome}
                          onClick={() => logCall(outcome)}
                          className="px-3 py-1.5 text-xs border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
                        >
                          {outcome}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={callNotes}
                      onChange={(event) => setCallNotes(event.target.value)}
                      placeholder="Call notes..."
                      className="w-full min-h-20 p-2 text-sm border border-slate-200 rounded-md"
                    />
                  </div>
                ) : composeChannel === 'email' ? (
                  <div className="p-3 space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEmailComposeMode('reply');
                          const latest = emailThreads[0];
                          if (latest) {
                            setSelectedEmailThreadId(latest.id);
                            setEmailSubject(ensureReplySubject(latest.subject));
                          }
                        }}
                        className={`px-2 py-1 text-xs rounded-md border ${
                          emailComposeMode === 'reply'
                            ? 'border-slate-900 text-slate-900 bg-slate-50'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                        disabled={emailThreads.length === 0}
                      >
                        Reply to existing thread
                      </button>
                      <button
                        onClick={() => {
                          setEmailComposeMode('new');
                          setSelectedEmailThreadId('');
                          setEmailSubject('');
                        }}
                        className={`px-2 py-1 text-xs rounded-md border ${
                          emailComposeMode === 'new'
                            ? 'border-slate-900 text-slate-900 bg-slate-50'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        New Email
                      </button>
                    </div>

                    {emailComposeMode === 'reply' && (
                      <select
                        value={selectedEmailThreadId}
                        onChange={(event) => {
                          const nextId = event.target.value;
                          setSelectedEmailThreadId(nextId);
                          const thread = emailThreads.find((item) => item.id === nextId);
                          if (thread) {
                            setEmailSubject(ensureReplySubject(thread.subject));
                            if (thread.senderProfileUuid) {
                              setSelectedSenderProfileUuid(thread.senderProfileUuid);
                            }
                          }
                        }}
                        className="w-full p-2 text-xs border border-slate-200 rounded-md bg-white"
                      >
                        {emailThreads.length === 0 ? (
                          <option value="">No existing threads</option>
                        ) : (
                          emailThreads.map((thread) => (
                            <option key={thread.id} value={thread.id}>
                              {thread.subject}
                            </option>
                          ))
                        )}
                      </select>
                    )}

                    <select
                      value={selectedSenderProfileUuid}
                      onChange={(event) => setSelectedSenderProfileUuid(event.target.value)}
                      className="w-full p-2 text-xs border border-slate-200 rounded-md bg-white"
                      disabled={loadingSenderProfiles}
                    >
                      {senderProfiles.length === 0 ? (
                        <option value="">
                          {loadingSenderProfiles ? 'Loading sender profiles...' : 'No sender profiles available'}
                        </option>
                      ) : (
                        senderProfiles.map((profile) => (
                          <option key={profile.uuid} value={profile.uuid}>
                            {senderProfileLabel(profile)}
                          </option>
                        ))
                      )}
                    </select>

                    <input
                      value={emailSubject}
                      onChange={(event) => setEmailSubject(event.target.value)}
                      placeholder="Subject"
                      className="w-full p-2 text-sm border border-slate-200 rounded-md"
                    />
                    <textarea
                      value={composeText}
                      onChange={(event) => setComposeText(event.target.value)}
                      placeholder="Write email message..."
                      className="w-full min-h-24 p-2 text-sm border border-slate-200 rounded-md"
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          void addAttachments(event.target.files);
                        }}
                      />
                      <button
                        onClick={() => attachmentInputRef.current?.click()}
                        className="px-2 py-1 text-xs rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        Attach file
                      </button>
                      {emailAttachments.map((attachment) => (
                        <span
                          key={attachment.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] text-slate-700"
                        >
                          {attachment.filename}
                          <button
                            onClick={() => {
                              setEmailAttachments((prev) =>
                                prev.filter((item) => item.id !== attachment.id)
                              );
                            }}
                            className="text-slate-500 hover:text-slate-700"
                            title="Remove attachment"
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={sendCompose}
                        className="px-4 py-1.5 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-700"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ) : composeChannel === 'linkedin' ? (
                  <div className="p-3 space-y-2">
                    <select
                      value={selectedLinkedInSenderProfileUuid}
                      onChange={(event) => setSelectedLinkedInSenderProfileUuid(event.target.value)}
                      className="w-full p-2 text-xs border border-slate-200 rounded-md bg-white"
                      disabled={loadingLinkedInSenderProfiles}
                    >
                      {linkedInSenderProfiles.length === 0 ? (
                        <option value="">
                          {loadingLinkedInSenderProfiles ? 'Loading LinkedIn senders...' : 'No LinkedIn sender profiles available'}
                        </option>
                      ) : (
                        linkedInSenderProfiles.map((profile) => (
                          <option key={profile.uuid} value={profile.uuid}>
                            {linkedInSenderProfileLabel(profile)}
                          </option>
                        ))
                      )}
                    </select>
                    <textarea
                      value={composeText}
                      onChange={(event) => setComposeText(event.target.value)}
                      placeholder="Write linkedin message..."
                      className="w-full min-h-24 p-2 text-sm border border-slate-200 rounded-md"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={sendCompose}
                        className="px-4 py-1.5 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-700"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    <textarea
                      value={composeText}
                      onChange={(event) => setComposeText(event.target.value)}
                      placeholder={composeChannel === 'note' ? 'Add note...' : `Write ${composeChannel} message...`}
                      className="w-full min-h-24 p-2 text-sm border border-slate-200 rounded-md"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={sendCompose}
                        className="px-4 py-1.5 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-700"
                      >
                        {composeChannel === 'note' ? 'Save Note' : composeChannel === 'text' ? 'Log Text' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">Select a lead</div>
          )}
        </div>

        <div
          onMouseDown={() => setDragging('right')}
          className="w-1 cursor-col-resize bg-transparent hover:bg-slate-300 transition-colors"
        />

        <div className="bg-white border-l border-slate-200 overflow-y-auto" style={{ width: rightWidth }}>
          {selectedLead && (
            <div className="p-4">
              <div className="text-center border-b border-slate-100 pb-4">
                <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-semibold">
                  {(selectedLead.first_name?.[0] || '') + (selectedLead.last_name?.[0] || '')}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-900">{fullName(selectedLead)}</h3>
                <p className="text-xs text-slate-500">{selectedLead.title || 'Unknown title'}</p>
                <p className="text-xs text-slate-400">{selectedLead.company || 'Unknown company'}</p>
              </div>

              <div className="py-4 border-b border-slate-100 space-y-3">
                <h4 className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Contact</h4>
                <div className="text-xs text-slate-700">
                  <p className="text-slate-400">EMAIL</p>
                  <p>{selectedLead.email || '—'}</p>
                </div>
                <div className="text-xs text-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-400">PHONE NUMBERS</p>
                  </div>
                  <div className="mt-1 space-y-1.5">
                    {selectedLeadPhoneNumbers.map((phone, index) => {
                      const telHref = toTelHref(phone);
                      const isEditing = editingPhoneIndex === index;
                      return (
                        <div key={`${selectedLead.id}-phone-${index}`} className="flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <input
                                type="tel"
                                value={phoneInput}
                                onChange={(event) => setPhoneInput(event.target.value)}
                                className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                                placeholder="Phone number"
                              />
                              <button
                                onClick={() => savePhoneEdit(index)}
                                disabled={savingPhone || !phoneInput.trim()}
                                className="h-6 w-6 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                title="Save"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditingPhoneIndex(null);
                                  setPhoneInput('');
                                }}
                                className="h-6 w-6 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                                title="Cancel"
                              >
                                x
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="min-w-0 flex-1 truncate">{phone}</span>
                              {telHref && (
                                <a
                                  href={telHref}
                                  className="h-6 px-1.5 inline-flex items-center rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  title="Call (right-click to use native options)"
                                >
                                  Call
                                </a>
                              )}
                              <button
                                onClick={() => {
                                  setEditingPhoneIndex(index);
                                  setPhoneInput(phone);
                                }}
                                className="h-6 w-6 inline-flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                                title="Edit"
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.423.258l-3 1a1 1 0 01-1.265-1.265l1-3a1 1 0 01.258-.423l8.95-8.95zM12.172 5L5 12.172V14h1.828L14 6.828 12.172 5z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deletePhone(index)}
                                disabled={savingPhone}
                                className="h-6 w-6 inline-flex items-center justify-center rounded border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                title="Delete"
                              >
                                x
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {editingPhoneIndex === selectedLeadPhoneNumbers.length && selectedLeadPhoneNumbers.length < MAX_PHONE_NUMBERS && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="tel"
                          value={phoneInput}
                          onChange={(event) => setPhoneInput(event.target.value)}
                          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                          placeholder="Add phone number"
                        />
                        <button
                          onClick={() => savePhoneEdit(selectedLeadPhoneNumbers.length)}
                          disabled={savingPhone || !phoneInput.trim()}
                          className="h-6 w-6 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setEditingPhoneIndex(null);
                            setPhoneInput('');
                          }}
                          className="h-6 w-6 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                          title="Cancel"
                        >
                          x
                        </button>
                      </div>
                    )}

                    {selectedLeadPhoneNumbers.length === 0 && editingPhoneIndex === null && (
                      <p className="text-slate-500">—</p>
                    )}

                    <div className="pt-1 flex items-center gap-1.5">
                      {selectedLeadPhoneNumbers.length < MAX_PHONE_NUMBERS && editingPhoneIndex === null && (
                        <button
                          onClick={() => {
                            setEditingPhoneIndex(selectedLeadPhoneNumbers.length);
                            setPhoneInput('');
                          }}
                          className="px-2 py-1 text-[11px] rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                        >
                          Add Phone
                        </button>
                      )}
                      <button
                        onClick={enrichPhonesFromApollo}
                        disabled={enrichingPhone}
                        className="px-2 py-1 text-[11px] rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {enrichingPhone ? 'Enriching...' : 'Enrich from Apollo'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-700">
                  <p className="text-slate-400">LINKEDIN</p>
                  <div className="mt-1">
                    {selectedLead.linkedin_url ? (
                      <a
                        href={selectedLead.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 text-indigo-600 hover:underline break-all"
                      >
                        {selectedLead.linkedin_url}
                      </a>
                    ) : (
                      <p className="text-slate-500">—</p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-700">
                  <p className="text-slate-400">WEBSITE</p>
                  <div className="mt-1">
                    {editingWebsite ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="url"
                          value={websiteInput}
                          onChange={(event) => setWebsiteInput(event.target.value)}
                          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                          placeholder="https://company.com"
                        />
                        <button
                          onClick={saveWebsite}
                          disabled={savingWebsite || !websiteInput.trim()}
                          className="h-6 w-6 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setEditingWebsite(false);
                            setWebsiteInput('');
                          }}
                          className="h-6 w-6 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                          title="Cancel"
                        >
                          x
                        </button>
                      </div>
                    ) : selectedLead.company_website ? (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={selectedLead.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 text-indigo-600 hover:underline truncate"
                        >
                          {selectedLead.company_website}
                        </a>
                        <button
                          onClick={() => {
                            setEditingWebsite(true);
                            setWebsiteInput(selectedLead.company_website || '');
                          }}
                          className="h-6 w-6 inline-flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                          title="Edit website"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.95 8.95a1 1 0 01-.423.258l-3 1a1 1 0 01-1.265-1.265l1-3a1 1 0 01.258-.423l8.95-8.95zM12.172 5L5 12.172V14h1.828L14 6.828 12.172 5z" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingWebsite(true);
                          setWebsiteInput('');
                        }}
                        className="px-2 py-1 text-[11px] rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        Add Website
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-700">
                  <p className="text-slate-400">LOCATION</p>
                  <p>{selectedLead.location || '—'}</p>
                </div>
              </div>

              <div className="py-4 border-b border-slate-100 space-y-2">
                <h4 className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Details</h4>
                <p className="text-xs text-slate-600"><span className="text-slate-400">SOURCE:</span> {selectedLead.lead_source || selectedLead.source || '—'}</p>
                <p className="text-xs text-slate-600"><span className="text-slate-400">LEAD DATE:</span> {fmtRelative(selectedLead.created_at)}</p>
                <p className="text-xs text-slate-600"><span className="text-slate-400">LAST TOUCH:</span> {fmtRelative(selectedLead.last_activity_at || selectedLead.last_activity)}</p>
                <p className="text-xs text-slate-600"><span className="text-slate-400">DEAL STAGE:</span> {STAGE_LABELS[selectedLead.deal_stage || 'lead'] || 'Lead'}</p>
              </div>

              <div className="py-4">
                <h4 className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Notes</h4>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{selectedLead.notes || 'No notes yet.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {showCloseModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Close this lead?</h3>
              <p className="mt-2 text-sm text-slate-600">
                This will remove [{fullName(selectedLead)}] from your active feed permanently. Their full history will be
                saved but they will no longer receive follow-ups or appear in your queue.
              </p>
            </div>
            <div className="px-5 py-3 flex justify-end gap-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={closeLead}
                className="px-3 py-1.5 text-xs rounded-md border border-rose-200 bg-rose-600 text-white hover:bg-rose-700"
              >
                Close Lead
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Add Lead</h3>
              <p className="mt-1 text-sm text-slate-500">Create a lead for today&apos;s queue.</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={addLeadForm.linkedin_url}
                  onChange={(event) => {
                    setAddLeadForm((prev) => ({ ...prev, linkedin_url: event.target.value }));
                    if (addLeadEnrichMessage) setAddLeadEnrichMessage('');
                  }}
                  placeholder="LinkedIn Profile URL"
                  className="w-full p-2 text-sm border border-slate-200 rounded-md"
                />
                <button
                  onClick={enrichAddLeadFromLinkedIn}
                  disabled={enrichingAddLead || !addLeadForm.linkedin_url.trim()}
                  className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {enrichingAddLead ? 'Enriching...' : 'Enrich'}
                </button>
              </div>
              {addLeadEnrichMessage && (
                <p className="text-xs text-slate-500">{addLeadEnrichMessage}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={addLeadForm.first_name}
                  onChange={(event) =>
                    setAddLeadForm((prev) => ({ ...prev, first_name: event.target.value }))
                  }
                  placeholder="First Name *"
                  className="w-full p-2 text-sm border border-slate-200 rounded-md"
                />
                <input
                  value={addLeadForm.last_name}
                  onChange={(event) =>
                    setAddLeadForm((prev) => ({ ...prev, last_name: event.target.value }))
                  }
                  placeholder="Last Name *"
                  className="w-full p-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <input
                value={addLeadForm.title}
                onChange={(event) =>
                  setAddLeadForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Title"
                className="w-full p-2 text-sm border border-slate-200 rounded-md"
              />
              <input
                value={addLeadForm.company}
                onChange={(event) =>
                  setAddLeadForm((prev) => ({ ...prev, company: event.target.value }))
                }
                placeholder="Company"
                className="w-full p-2 text-sm border border-slate-200 rounded-md"
              />
              <input
                value={addLeadForm.company_website}
                onChange={(event) =>
                  setAddLeadForm((prev) => ({ ...prev, company_website: event.target.value }))
                }
                placeholder="Company Website"
                className="w-full p-2 text-sm border border-slate-200 rounded-md"
              />
              <input
                value={addLeadForm.email}
                onChange={(event) =>
                  setAddLeadForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="Email"
                className="w-full p-2 text-sm border border-slate-200 rounded-md"
              />
              <input
                value={addLeadForm.phone}
                onChange={(event) =>
                  setAddLeadForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="Phone"
                className="w-full p-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddLeadModal(false);
                  resetAddLeadForm();
                }}
                className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitAddLead}
                disabled={
                  addingLead ||
                  !addLeadForm.first_name.trim() ||
                  !addLeadForm.last_name.trim()
                }
                className="px-3 py-1.5 text-xs rounded-md border border-slate-900 bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {addingLead ? 'Creating...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
