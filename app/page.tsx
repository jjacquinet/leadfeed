'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Lead } from '@/lib/types';
import ChannelIcon from '@/components/ui/ChannelIcon';
import { cleanEmailReplyContent } from '@/lib/utils';

type FeedTab = 'all' | 'replies' | 'done';
type ComposeChannel = 'email' | 'call' | 'linkedin' | 'text' | 'note';

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
  if (activity.direction === 'inbound') return 'bg-white border border-slate-200 text-slate-700';
  if (activity.type.startsWith('email')) return 'bg-indigo-50 border border-indigo-100 text-slate-700';
  if (activity.type.startsWith('linkedin')) return 'bg-blue-50 border border-blue-100 text-slate-700';
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

export default function HomePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activitiesByLead, setActivitiesByLead] = useState<Record<string, Activity[]>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [tab, setTab] = useState<FeedTab>('all');
  const [composeChannel, setComposeChannel] = useState<ComposeChannel>('email');
  const [composeText, setComposeText] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [showSnoozeBar, setShowSnoozeBar] = useState(false);
  const [snoozedCount, setSnoozedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(260);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );
  const selectedActivities = useMemo(() => {
    const activities = selectedLeadId ? activitiesByLead[selectedLeadId] || [] : [];
    return activities.filter((activity) => !isRawWebhookPayload(activity.content));
  }, [selectedLeadId, activitiesByLead]);

  const loadLeads = useCallback(async () => {
    const [activeRes, snoozedRes] = await Promise.all([
      fetch('/api/leads?status=active'),
      fetch('/api/leads?status=snoozed'),
    ]);
    const [activeData, snoozedData] = await Promise.all([activeRes.json(), snoozedRes.json()]);
    const fetchedLeads = Array.isArray(activeData) ? activeData : [];
    setLeads(fetchedLeads);
    setSnoozedCount(Array.isArray(snoozedData) ? snoozedData.length : 0);

    if (!selectedLeadId && fetchedLeads.length > 0) {
      setSelectedLeadId(fetchedLeads[0].id);
    } else if (selectedLeadId && !fetchedLeads.some((lead: Lead) => lead.id === selectedLeadId)) {
      setSelectedLeadId(fetchedLeads[0]?.id || null);
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
    const activeLeads = leads.filter((lead) => !doneIds.has(lead.id));
    const doneLeads = leads.filter((lead) => doneIds.has(lead.id));
    if (tab === 'done') return doneLeads;
    if (tab === 'replies') return activeLeads.filter((lead) => Boolean(lead.has_unread));
    return [...activeLeads, ...doneLeads];
  }, [leads, doneIds, tab]);

  const needsReplyCount = useMemo(
    () => leads.filter((lead) => Boolean(lead.has_unread) && !doneIds.has(lead.id)).length,
    [leads, doneIds]
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
    if (!selectedLeadId) return;
    setDoneIds((prev) => new Set([...prev, selectedLeadId]));
    setShowSnoozeBar(true);
    setComposeText('');
    setCallNotes('');
  };

  const sendCompose = async () => {
    if (!selectedLead || !selectedLeadId) return;

    if (composeChannel === 'call') return;
    if (!composeText.trim()) return;

    if (composeChannel === 'email' || composeChannel === 'linkedin') {
      const senderProfilesRes = await fetch('/api/getsales/sender-profiles');
      const senderProfiles = await senderProfilesRes.json();
      const senderProfileUuid = Array.isArray(senderProfiles) ? senderProfiles[0]?.uuid : null;
      if (!senderProfileUuid) {
        alert('No sender profile available for sending.');
        return;
      }

      await fetch('/api/messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadId,
          channel: composeChannel,
          sender_profile_uuid: senderProfileUuid,
          content: composeText.trim(),
          subject: composeChannel === 'email' ? 'Quick follow-up' : undefined,
        }),
      });
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
    const next = leads.find((lead) => lead.id !== selectedLeadId && !doneIds.has(lead.id));
    setShowSnoozeBar(false);
    await loadLeads();
    if (next) setSelectedLeadId(next.id);
  };

  const archiveLead = async () => {
    if (!selectedLeadId) return;
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedLeadId,
        status: 'archived',
      }),
    });
    await loadLeads();
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
            <span className="text-emerald-600"><strong>{doneIds.size}</strong> Done</span>
            <span className="text-slate-500"><strong>{snoozedCount}</strong> Snoozed</span>
            <button
              onClick={refreshQueue}
              className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 flex min-h-0">
        <div className="bg-white border-r border-slate-200 flex flex-col min-h-0" style={{ width: leftWidth }}>
          <div className="px-3 py-2 border-b border-slate-100 flex gap-2">
            {(['all', 'replies', 'done'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`px-2.5 py-1 text-xs rounded-md ${
                  tab === item ? 'bg-slate-100 text-slate-800 font-medium' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {item === 'all' ? 'All' : item === 'replies' ? 'Replies' : 'Done'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {queueLeads.map((lead) => {
              const selected = lead.id === selectedLeadId;
              const done = doneIds.has(lead.id);
              return (
                <button
                  key={lead.id}
                  onClick={() => selectLead(lead)}
                  className={`w-full text-left p-3 border-b border-slate-100 ${
                    selected ? 'bg-slate-50 border-l-2 border-l-slate-800' : ''
                  } ${done ? 'opacity-50' : ''}`}
                >
                  <div className="flex justify-between gap-2 items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-900 truncate">{fullName(lead)}</span>
                        {lead.has_unread && !done && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
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
                  <button
                    onClick={() => setShowSnoozeBar(true)}
                    className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    Snooze
                  </button>
                  <button
                    onClick={archiveLead}
                    className="px-3 py-1.5 text-xs rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    Archive
                  </button>
                </div>
              </div>

              <div ref={timelineRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`flex ${activity.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
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
                  <span className="text-sm text-emerald-700 font-medium">Done! Snooze:</span>
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
                  <p className="text-slate-400">PHONE</p>
                  <p>{selectedLead.phone || '—'}</p>
                </div>
                <div className="text-xs text-slate-700">
                  <p className="text-slate-400">LINKEDIN</p>
                  <p className="break-all">{selectedLead.linkedin_url || '—'}</p>
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
    </div>
  );
}
