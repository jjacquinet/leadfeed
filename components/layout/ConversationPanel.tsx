'use client';

import { Lead, Message } from '@/lib/types';
import ConversationThread from '@/components/conversation/ConversationThread';
import MessageComposer from '@/components/conversation/MessageComposer';
import Avatar from '@/components/ui/Avatar';

interface ConversationPanelProps {
  lead: Lead | null;
  messages: Message[];
  onSendNote: (content: string) => void;
}

export default function ConversationPanel({ lead, messages, onSendNote }: ConversationPanelProps) {
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

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
        <Avatar firstName={lead.first_name} lastName={lead.last_name} size="sm" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {lead.first_name} {lead.last_name}
          </h2>
          {lead.company && (
            <p className="text-xs text-gray-500">{lead.title ? `${lead.title} at ` : ''}{lead.company}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ConversationThread messages={sortedMessages} />

      {/* Composer */}
      <MessageComposer onSendNote={onSendNote} />
    </div>
  );
}
