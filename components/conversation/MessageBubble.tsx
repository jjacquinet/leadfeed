'use client';

import { Message } from '@/lib/types';
import ChannelIcon from '@/components/ui/ChannelIcon';
import { formatDateTime } from '@/lib/utils';

/** Render content with basic markdown bold (**text**) support */
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  if (message.is_note) {
    return (
      <div className="flex justify-center my-3">
        <div className="max-w-lg w-full bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="text-xs font-semibold text-amber-700">Note</span>
            <span className="text-xs text-amber-500 ml-auto">{formatDateTime(message.timestamp)}</span>
          </div>
          <p className="text-sm text-amber-900">{message.content}</p>
        </div>
      </div>
    );
  }

  const isOutbound = message.direction === 'outbound';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} my-2`}>
      <div className={`max-w-[70%] ${isOutbound ? 'order-1' : ''}`}>
        <div className={`flex items-center gap-1.5 mb-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          <ChannelIcon channel={message.channel} className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-400">{formatDateTime(message.timestamp)}</span>
        </div>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isOutbound
              ? 'bg-indigo-600 text-white rounded-br-md'
              : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
          }`}
        >
          {renderContent(message.content)}
        </div>
      </div>
    </div>
  );
}
