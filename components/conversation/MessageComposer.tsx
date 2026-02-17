'use client';

import { useState } from 'react';
import { MessageChannel } from '@/lib/types';
import ChannelIcon from '@/components/ui/ChannelIcon';

interface MessageComposerProps {
  onSendNote: (content: string) => void;
  disabled?: boolean;
}

export default function MessageComposer({ onSendNote, disabled }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [channel, setChannel] = useState<MessageChannel>('linkedin');

  const handleSubmit = () => {
    if (!content.trim()) return;
    if (isNoteMode) {
      onSendNote(content.trim());
      setContent('');
      setIsNoteMode(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`border-t ${isNoteMode ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
      {isNoteMode && (
        <div className="px-4 pt-2 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span className="text-xs font-semibold text-amber-700">Adding a note</span>
          <button
            onClick={() => { setIsNoteMode(false); setContent(''); }}
            className="ml-auto text-xs text-amber-600 hover:text-amber-800"
          >
            Cancel
          </button>
        </div>
      )}
      <div className="p-3 flex items-end gap-2">
        {!isNoteMode && (
          <div className="relative">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as MessageChannel)}
              className="appearance-none bg-gray-100 text-gray-600 text-xs px-2 py-2 pr-6 rounded-lg cursor-pointer focus:ring-2 focus:ring-indigo-500 border-0"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="text">Text</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-1 pointer-events-none">
              <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isNoteMode ? 'Write a note...' : 'Reply coming soon — add a note for now...'}
          rows={1}
          disabled={disabled}
          className={`flex-1 resize-none text-sm px-3 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
            isNoteMode
              ? 'bg-white border-amber-300 placeholder-amber-400'
              : 'bg-gray-50 border-gray-200 placeholder-gray-400'
          }`}
        />
        {!isNoteMode ? (
          <button
            onClick={() => setIsNoteMode(true)}
            className="shrink-0 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
          >
            Add Note
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="shrink-0 px-4 py-2 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Note
          </button>
        )}
      </div>
    </div>
  );
}
