'use client';

import { Lead } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import { formatRelativeTime } from '@/lib/utils';

interface LeadListItemProps {
  lead: Lead;
  isActive: boolean;
  lastMessage?: string;
  onClick: () => void;
}

export default function LeadListItem({ lead, isActive, lastMessage, onClick }: LeadListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 flex items-start gap-3 transition-colors border-b border-gray-100 hover:bg-gray-50 ${
        isActive ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
      }`}
    >
      <Avatar firstName={lead.first_name} lastName={lead.last_name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
            {lead.first_name} {lead.last_name}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {formatRelativeTime(lead.last_activity)}
          </span>
        </div>
        {lead.company && (
          <p className="text-xs text-gray-500 truncate">{lead.company}</p>
        )}
        {lastMessage && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{lastMessage}</p>
        )}
      </div>
    </button>
  );
}
