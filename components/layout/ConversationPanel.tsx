'use client';

import { Lead, Message } from '@/lib/types';
import ConversationThread from '@/components/conversation/ConversationThread';
import MessageComposer from '@/components/conversation/MessageComposer';
import Avatar from '@/components/ui/Avatar';

interface ConversationPanelProps {
  lead: Lead | null;
  messages: Message[];
  onSendNote: (content: string) => void;
  syncing?: boolean;
  onRefresh?: () => void;
}

export default function ConversationPanel({ lead, messages, onSendNote, syncing, onRefresh }: ConversationPanelProps) {
  if (!lead) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-500">Select a lead</h3>
          <p className="text-sm text-gray-400 mt-1">Choose a lead from the sidebar to view their conversation</p>
        </div>
      </div>
    );
  }

  // Filter out raw webhook debug notes from display
  const displayMessages = messages.filter(
    (m) => !m.is_note || !m.content.startsWith('[Raw webhook payload]')
  );

  const sortedMessages = [...displayMessages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
        <Avatar firstName={lead.first_name} lastName={lead.last_name} size="sm" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-900">
            {lead.first_name} {lead.last_name}
          </h2>
          {lead.company && (
            <p className="text-xs text-gray-500">{lead.title ? `${lead.title} at ` : ''}{lead.company}</p>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            title="Sync conversations from GetSales.io"
          >
            <svg
              className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
        )}
      </div>

      {/* Messages */}
      <ConversationThread messages={sortedMessages} />

      {/* Composer */}
      <MessageComposer onSendNote={onSendNote} />
    </div>
  );
}
