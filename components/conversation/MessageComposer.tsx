'use client';

import { useEffect, useState } from 'react';
import { MessageChannel, SenderProfile } from '@/lib/types';

const LINKEDIN_SENDER_PROFILES: Record<string, string> = {
  '06f84941-fd7b-4685-8610-3b533d9df603': 'John Jacquinet',
  '1dc5c804-3c6b-4f93-a591-f7b877b7f590': 'Antonia Carbone',
  'fb871e83-4a03-427f-a001-115c304cdd40': 'Juli Hernandez',
  'e41d23df-9606-4e92-8b56-90e3c1d1b124': 'Andres Villa',
  'fa7312ff-fb9a-448b-b492-35a7d2fc4749': 'Connor Holland',
  '55243059-6f28-492f-9a51-4741ff92f7b2': 'Jaime Martinez',
  '34fd3858-9456-423c-a487-626267630503': 'Charlie Parfet',
  'bca6e1a4-0d52-4144-83c6-d7bad52efc91': 'Kevin Hepburn',
  '9ba5beeb-c428-480c-877b-6cc4cdd9aab8': 'Sonia Vargas',
  'd0cea563-c804-40fb-88a7-a6b9ca4faa6a': 'David Esparza',
  '0c9784ad-1e07-4879-9ac2-160cda154f4d': 'Michelle Harvin',
};

interface MessageComposerProps {
  senderProfiles: SenderProfile[];
  onSendNote: (content: string) => Promise<void>;
  onSendReply: (payload: {
    channel: 'linkedin' | 'email';
    senderProfileUuid: string;
    content: string;
    subject?: string;
    fromName?: string;
    fromEmail?: string;
  }) => Promise<void>;
  disabled?: boolean;
  draft?: {
    channel: 'linkedin' | 'email';
    subject?: string;
    content: string;
  } | null;
  draftVersion?: number;
  onDraftApplied?: () => void;
}

export default function MessageComposer({
  senderProfiles,
  onSendNote,
  onSendReply,
  disabled,
  draft,
  draftVersion,
  onDraftApplied,
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [channel, setChannel] = useState<MessageChannel>('linkedin');
  const [subject, setSubject] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableReplyChannels = ['linkedin', 'email'] as const;
  const uniqueSenderProfiles = senderProfiles.filter((profile, index, array) => {
    return array.findIndex((candidate) => candidate.uuid === profile.uuid) === index;
  });
  const filteredSenderProfiles = uniqueSenderProfiles.filter((profile) => {
    if (channel === 'linkedin') {
      return Boolean(LINKEDIN_SENDER_PROFILES[profile.uuid]);
    }
    if (channel === 'email') {
      return Boolean(profile.from_email && profile.from_email.trim());
    }
    return true;
  });

  const selectedSenderProfileUuid = filteredSenderProfiles[0]?.uuid || '';
  const [senderProfileUuid, setSenderProfileUuid] = useState(selectedSenderProfileUuid);

  useEffect(() => {
    if (!filteredSenderProfiles.length) {
      setSenderProfileUuid('');
      return;
    }
    if (!filteredSenderProfiles.some((profile) => profile.uuid === senderProfileUuid)) {
      setSenderProfileUuid(filteredSenderProfiles[0].uuid);
    }
  }, [filteredSenderProfiles, senderProfileUuid]);

  useEffect(() => {
    if (!draft || !draftVersion) return;
    setIsNoteMode(false);
    setChannel(draft.channel);
    setContent(draft.content || '');
    setSubject(draft.subject || '');
    setError(null);
    onDraftApplied?.();
  }, [draft, draftVersion, onDraftApplied]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    if (isSubmitting || disabled) return;

    try {
      setIsSubmitting(true);
      setError(null);

      if (isNoteMode) {
        await onSendNote(content.trim());
        setContent('');
        setIsNoteMode(false);
        return;
      }

      if ((channel !== 'linkedin' && channel !== 'email') || !senderProfileUuid) {
        setError('Choose a valid channel and sender profile');
        return;
      }

      const selectedProfile = filteredSenderProfiles.find((profile) => profile.uuid === senderProfileUuid);
      if (channel === 'email' && !selectedProfile?.from_email) {
        setError('Selected sender profile does not have a mailbox email');
        return;
      }
      await onSendReply({
        channel,
        senderProfileUuid,
        content: content.trim(),
        subject: channel === 'email' ? subject.trim() : undefined,
        fromName: selectedProfile?.from_name ?? undefined,
        fromEmail: selectedProfile?.from_email ?? undefined,
      });
      setContent('');
      if (channel === 'email') setSubject('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to send');
    } finally {
      setIsSubmitting(false);
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
          <div className="flex gap-2 shrink-0">
            <div className="relative">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as MessageChannel)}
                className="appearance-none bg-gray-100 text-gray-600 text-xs px-2 py-2 pr-6 rounded-lg cursor-pointer focus:ring-2 focus:ring-indigo-500 border-0"
              >
                {availableReplyChannels.map((replyChannel) => (
                  <option key={replyChannel} value={replyChannel}>
                    {replyChannel === 'linkedin' ? 'LinkedIn' : 'Email'}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-1 pointer-events-none">
                <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div className="relative">
              <select
                value={senderProfileUuid}
                onChange={(e) => setSenderProfileUuid(e.target.value)}
                disabled={!filteredSenderProfiles.length}
                className="appearance-none bg-gray-100 text-gray-600 text-xs px-2 py-2 pr-6 rounded-lg cursor-pointer focus:ring-2 focus:ring-indigo-500 border-0 max-w-[220px] disabled:opacity-60"
              >
                {!filteredSenderProfiles.length && (
                  <option value="">
                    {channel === 'email' ? 'No email sender profiles' : 'No sender profiles'}
                  </option>
                )}
                {filteredSenderProfiles.map((profile) => (
                  <option key={profile.uuid} value={profile.uuid}>
                    {(() => {
                      const baseLabel = channel === 'linkedin'
                        ? LINKEDIN_SENDER_PROFILES[profile.uuid]
                        : (profile.label || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Sender');
                      if (channel === 'email' && profile.from_email) {
                        return `${baseLabel} (${profile.from_email})`;
                      }
                      return baseLabel;
                    })()}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-1 pointer-events-none">
                <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 space-y-2">
          {!isNoteMode && channel === 'email' && (
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              disabled={disabled || isSubmitting}
              className="w-full text-sm px-3 py-2 rounded-lg border bg-gray-50 border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isNoteMode ? 'Write a note...' : `Reply via ${channel === 'linkedin' ? 'LinkedIn' : 'Email'}...`}
            rows={1}
            disabled={disabled || isSubmitting}
            className={`w-full resize-none text-sm px-3 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              isNoteMode
                ? 'bg-white border-amber-300 placeholder-amber-400'
                : 'bg-gray-50 border-gray-200 placeholder-gray-400'
            }`}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
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
            disabled={!content.trim() || isSubmitting}
            className="shrink-0 px-4 py-2 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Note'}
          </button>
        )}
        {!isNoteMode && (
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting || !senderProfileUuid}
            className="shrink-0 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        )}
      </div>
    </div>
  );
}
