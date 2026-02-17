'use client';

import { Lead, LeadStage, STAGE_LABELS, STAGE_NAV_ORDER, Message } from '@/lib/types';
import LeadListItem from '@/components/leads/LeadListItem';
import Badge from '@/components/ui/Badge';

interface SidebarProps {
  leads: Lead[];
  messages: Record<string, Message[]>;
  activeStage: LeadStage;
  activeLeadId: string | null;
  stageCounts: Record<LeadStage, number>;
  onStageChange: (stage: LeadStage) => void;
  onLeadSelect: (leadId: string) => void;
}

const stageIcons: Record<LeadStage, React.ReactNode> = {
  lead_feed: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  snoozed: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),
  meeting_booked: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  closed_won: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  closed_lost: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
};

export default function Sidebar({
  leads,
  messages,
  activeStage,
  activeLeadId,
  stageCounts,
  onStageChange,
  onLeadSelect,
}: SidebarProps) {
  const filteredLeads = leads.filter((lead) => {
    if (activeStage === 'lead_feed') {
      return lead.stage === 'lead_feed';
    }
    return lead.stage === activeStage;
  });

  return (
    <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Outbounder AI</h1>
            <p className="text-[10px] text-gray-400">Lead Feed</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-3 border-b border-gray-200 space-y-0.5">
        {STAGE_NAV_ORDER.map((stage) => {
          const isActive = activeStage === stage;
          return (
            <button
              key={stage}
              onClick={() => onStageChange(stage)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={isActive ? 'text-indigo-500' : 'text-gray-400'}>
                {stageIcons[stage]}
              </span>
              <span className="flex-1 text-left">{STAGE_LABELS[stage]}</span>
              <Badge count={stageCounts[stage]} variant={isActive ? 'active' : 'default'} />
            </button>
          );
        })}
      </nav>

      {/* Lead List */}
      <div className="flex-1 overflow-y-auto">
        {filteredLeads.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-400">No leads in this stage</p>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const leadMessages = messages[lead.id] || [];
            const lastMsg = leadMessages.filter(m => !m.is_note).pop();
            return (
              <LeadListItem
                key={lead.id}
                lead={lead}
                isActive={activeLeadId === lead.id}
                lastMessage={lastMsg?.content}
                onClick={() => onLeadSelect(lead.id)}
              />
            );
          })
        )}
      </div>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-gray-200">
        <button className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
}
