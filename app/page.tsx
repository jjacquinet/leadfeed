'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lead, LeadStage, Message, SenderProfile, STAGE_NAV_ORDER } from '@/lib/types';
import Sidebar from '@/components/layout/Sidebar';
import ConversationPanel from '@/components/layout/ConversationPanel';
import DetailPanel from '@/components/layout/DetailPanel';
import Toast from '@/components/ui/Toast';

export default function HomePage() {
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [activeStage, setActiveStage] = useState<LeadStage>('lead_feed');
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [senderProfiles, setSenderProfiles] = useState<SenderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  // Fetch all leads on mount and when stage changes
  const fetchLeads = useCallback(async () => {
    try {
      // Fetch all stages in parallel for counts
      const responses = await Promise.all(
        STAGE_NAV_ORDER.map((stage) =>
          fetch(`/api/leads?stage=${stage}`).then((r) => r.json())
        )
      );

      const allFetchedLeads: Lead[] = [];
      const seenIds = new Set<string>();

      responses.forEach((data) => {
        if (Array.isArray(data)) {
          data.forEach((lead: Lead) => {
            if (!seenIds.has(lead.id)) {
              seenIds.add(lead.id);
              allFetchedLeads.push(lead);
            }
          });
        }
      });

      setAllLeads(allFetchedLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    const fetchSenderProfiles = async () => {
      try {
        const response = await fetch('/api/getsales/sender-profiles');
        const data = await response.json();
        if (Array.isArray(data)) {
          setSenderProfiles(data);
        }
      } catch (error) {
        console.error('Error fetching sender profiles:', error);
      }
    };
    fetchSenderProfiles();
  }, []);

  const [syncing, setSyncing] = useState(false);

  // Sync conversations from GetSales.io then fetch messages
  const syncAndFetchMessages = useCallback(async (leadId: string) => {
    setSyncing(true);
    try {
      // Sync from GetSales.io API (pulls LinkedIn + email conversations)
      await fetch(`/api/leads/sync?lead_id=${leadId}`, { method: 'POST' });
    } catch (error) {
      console.error('Error syncing from GetSales:', error);
    }
    // Always fetch messages regardless of sync result
    try {
      const response = await fetch(`/api/messages?lead_id=${leadId}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setMessages((prev) => ({ ...prev, [leadId]: data }));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Fetch messages only (without sync — for when we add notes locally)
  const fetchMessages = useCallback(async (leadId: string) => {
    try {
      const response = await fetch(`/api/messages?lead_id=${leadId}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setMessages((prev) => ({ ...prev, [leadId]: data }));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  useEffect(() => {
    if (activeLeadId) {
      syncAndFetchMessages(activeLeadId);
    }
  }, [activeLeadId, syncAndFetchMessages]);

  // Compute stage counts
  const stageCounts = STAGE_NAV_ORDER.reduce((acc, stage) => {
    if (stage === 'lead_feed') {
      acc[stage] = allLeads.filter(
        (l) =>
          l.stage === 'lead_feed' ||
          (l.stage === 'snoozed' && l.snoozed_until && new Date(l.snoozed_until) <= new Date())
      ).length;
    } else {
      acc[stage] = allLeads.filter(
        (l) => l.stage === 'snoozed' && l.snoozed_until && new Date(l.snoozed_until) > new Date()
      ).length;
    }
    return acc;
  }, {} as Record<LeadStage, number>);

  // Get filtered leads for current stage view
  const getFilteredLeads = (): Lead[] => {
    let filtered: Lead[];
    if (activeStage === 'lead_feed') {
      filtered = allLeads.filter(
        (l) =>
          l.stage === 'lead_feed' ||
          (l.stage === 'snoozed' && l.snoozed_until && new Date(l.snoozed_until) <= new Date())
      );
      filtered.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
    } else if (activeStage === 'snoozed') {
      filtered = allLeads.filter(
        (l) => l.stage === 'snoozed' && l.snoozed_until && new Date(l.snoozed_until) > new Date()
      );
      filtered.sort((a, b) => new Date(a.snoozed_until!).getTime() - new Date(b.snoozed_until!).getTime());
    } else {
      filtered = allLeads.filter((l) => l.stage === activeStage);
      filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return filtered;
  };

  const activeLead = allLeads.find((l) => l.id === activeLeadId) || null;
  const activeMessages = activeLeadId ? messages[activeLeadId] || [] : [];

  // Handle stage change from nav
  const handleStageNavChange = (stage: LeadStage) => {
    setActiveStage(stage);
    setActiveLeadId(null);
  };

  // Handle lead selection
  const handleLeadSelect = (leadId: string) => {
    setActiveLeadId(leadId);
  };

  // Handle manual refresh of conversations
  const handleRefreshConversation = () => {
    if (activeLeadId) {
      syncAndFetchMessages(activeLeadId);
      showToast('Syncing conversations...');
    }
  };

  // Handle adding a note
  const handleSendNote = async (content: string) => {
    if (!activeLeadId) return;

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: activeLeadId,
        content,
        is_note: true,
        channel: 'linkedin',
        direction: 'outbound',
      }),
    });

    const newMessage = await response.json();
    if (!response.ok) {
      throw new Error(newMessage.error || 'Failed to add note');
    }
    if (newMessage.id) {
      setMessages((prev) => ({
        ...prev,
        [activeLeadId]: [...(prev[activeLeadId] || []), newMessage],
      }));
      showToast('Note added');
      fetchLeads();
    }
  };

  const handleSendReply = async ({
    channel,
    senderProfileUuid,
    content,
    subject,
    fromName,
    fromEmail,
  }: {
    channel: 'linkedin' | 'email';
    senderProfileUuid: string;
    content: string;
    subject?: string;
    fromName?: string;
    fromEmail?: string;
  }) => {
    if (!activeLeadId) return;

    const response = await fetch('/api/messages/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: activeLeadId,
        channel,
        sender_profile_uuid: senderProfileUuid,
        content,
        subject,
        from_name: fromName,
        from_email: fromEmail,
      }),
    });

    const newMessage = await response.json();
    if (!response.ok) {
      throw new Error(newMessage.error || newMessage.message || 'Failed to send reply');
    }
    if (newMessage.id) {
      setMessages((prev) => ({
        ...prev,
        [activeLeadId]: [...(prev[activeLeadId] || []), newMessage],
      }));
      showToast(channel === 'linkedin' ? 'LinkedIn message sent' : 'Email sent');
      fetchLeads();
    }
  };

  // Handle stage change
  const handleStageChange = async (leadId: string, stage: LeadStage) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, stage }),
      });

      const updatedLead = await response.json();
      if (updatedLead.id) {
        setAllLeads((prev) =>
          prev.map((l) => (l.id === leadId ? updatedLead : l))
        );
        showToast(`Stage changed to ${stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`);

        // Add system note
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            content: `Stage changed to ${stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
            is_note: true,
            channel: 'linkedin',
            direction: 'outbound',
          }),
        });

        if (activeLeadId === leadId) {
          fetchMessages(leadId);
        }
      }
    } catch (error) {
      console.error('Error changing stage:', error);
    }
  };

  // Handle snooze
  const handleSnooze = async (leadId: string, until: Date) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leadId,
          stage: 'snoozed',
          snoozed_until: until.toISOString(),
        }),
      });

      const updatedLead = await response.json();
      if (updatedLead.id) {
        setAllLeads((prev) =>
          prev.map((l) => (l.id === leadId ? updatedLead : l))
        );

        const diffDays = Math.ceil((until.getTime() - Date.now()) / 86400000);
        const label = diffDays === 1 ? '1 day' : diffDays === 7 ? '1 week' : `${diffDays} days`;
        showToast(`Snoozed for ${label}`);

        // Add system note
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            content: `Snoozed until ${until.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${until.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
            is_note: true,
            channel: 'linkedin',
            direction: 'outbound',
          }),
        });

        if (activeLeadId === leadId) {
          fetchMessages(leadId);
        }
      }
    } catch (error) {
      console.error('Error snoozing lead:', error);
    }
  };

  // Handle unsnooze
  const handleUnsnooze = async (leadId: string) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leadId,
          stage: 'lead_feed',
          snoozed_until: null,
        }),
      });

      const updatedLead = await response.json();
      if (updatedLead.id) {
        setAllLeads((prev) =>
          prev.map((l) => (l.id === leadId ? updatedLead : l))
        );
        showToast('Lead unsnoozed');
      }
    } catch (error) {
      console.error('Error unsnoozing lead:', error);
    }
  };

  // Handle phone numbers update
  const handlePhoneNumbersUpdate = async (leadId: string, phoneNumbers: string[]) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, phone_numbers: phoneNumbers }),
      });

      const updatedLead = await response.json();
      if (updatedLead.id) {
        setAllLeads((prev) =>
          prev.map((lead) => (lead.id === leadId ? updatedLead : lead))
        );
        showToast('Phone numbers updated');
      }
    } catch (error) {
      console.error('Error updating phone numbers:', error);
    }
  };

  const handlePhoneEnrich = async (leadId: string) => {
    try {
      const response = await fetch('/api/leads/enrich-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to enrich phone numbers');
      }

      if (payload?.lead?.id) {
        setAllLeads((prev) =>
          prev.map((lead) => (lead.id === leadId ? payload.lead : lead))
        );
        if (payload.queued && payload.added === 0) {
          showToast('Enrichment requested. Apollo will update phones shortly.');
        } else if (payload.added > 0) {
          showToast(`Added ${payload.added} phone number${payload.added === 1 ? '' : 's'}`);
        } else {
          showToast('No new phone numbers found');
        }
      }
    } catch (error) {
      console.error('Error enriching phone numbers:', error);
      showToast(error instanceof Error ? error.message : 'Phone enrichment failed');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-3 animate-pulse">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <p className="text-sm text-gray-500">Loading Outbounder AI...</p>
        </div>
      </div>
    );
  }

  const filteredLeads = getFilteredLeads();

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        leads={filteredLeads}
        messages={messages}
        activeStage={activeStage}
        activeLeadId={activeLeadId}
        stageCounts={stageCounts}
        onStageChange={handleStageNavChange}
        onLeadSelect={handleLeadSelect}
      />
      <ConversationPanel
        lead={activeLead}
        messages={activeMessages}
        senderProfiles={senderProfiles}
        onSendNote={handleSendNote}
        onSendReply={handleSendReply}
        syncing={syncing}
        onRefresh={handleRefreshConversation}
      />
      <DetailPanel
        lead={activeLead}
        onStageChange={handleStageChange}
        onSnooze={handleSnooze}
        onUnsnooze={handleUnsnooze}
        onPhoneNumbersUpdate={handlePhoneNumbersUpdate}
        onPhoneEnrich={handlePhoneEnrich}
      />
      <Toast
        message={toast.message}
        isVisible={toast.visible}
        onClose={hideToast}
      />
    </div>
  );
}
