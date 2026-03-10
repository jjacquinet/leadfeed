'use client';

import { useMemo, useState } from 'react';
import { Lead, LeadStage, Message } from '@/lib/types';

type DraftReply = {
  leadId?: string;
  channel: 'linkedin' | 'email';
  subject?: string;
  content: string;
  rationale?: string;
};

type LeadRanking = {
  leads: Array<{
    leadId: string;
    reason: string;
    score?: number;
  }>;
};

type AssistantTurn = {
  role: 'user' | 'assistant';
  content: string;
  actions?: {
    draftReply?: DraftReply;
    leadRanking?: LeadRanking;
  } | null;
};

interface AiAssistantPanelProps {
  allLeads: Lead[];
  visibleLeads: Lead[];
  activeLead: Lead | null;
  activeMessages: Message[];
  activeStage: LeadStage;
  onUseDraft: (draft: DraftReply) => void;
}

export default function AiAssistantPanel({
  allLeads,
  visibleLeads,
  activeLead,
  activeMessages,
  activeStage,
  onUseDraft,
}: AiAssistantPanelProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<AssistantTurn[]>([
    {
      role: 'assistant',
      content:
        "I'm your lead copilot. I can rank the best leads to target, explain why, and draft replies from the selected conversation.",
    },
  ]);

  const leadNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of allLeads) {
      map.set(lead.id, `${lead.first_name} ${lead.last_name}`.trim());
    }
    return map;
  }, [allLeads]);

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;

    const nextTurns = [...turns, { role: 'user' as const, content: trimmed }];
    setTurns(nextTurns);
    setInput('');
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversation: nextTurns.map((turn) => ({ role: turn.role, content: turn.content })),
          uiContext: {
            activeLeadId: activeLead?.id || null,
            activeStage,
            visibleLeadIds: visibleLeads.map((lead) => lead.id),
            activeConversationMessageCount: activeMessages.length,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || payload.message || 'Failed to get AI response');
      }

      setTurns((current) => [
        ...current,
        {
          role: 'assistant',
          content: payload.reply || 'No response returned.',
          actions: payload.actions || null,
        },
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full bg-white border-l border-gray-200 flex flex-col min-w-0">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Claude Assistant</h3>
        <p className="text-xs text-gray-500 mt-1">
          {allLeads.length} leads loaded
          {activeLead ? ` • Active: ${activeLead.first_name} ${activeLead.last_name}` : ''}
        </p>
      </div>

      <div className="px-3 py-2 border-b border-gray-100 flex gap-2">
        <button
          onClick={() => sendMessage('Prioritize the best leads to target right now and explain why.')}
          disabled={isSending}
          className="text-xs px-2.5 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
        >
          Prioritize Leads
        </button>
        <button
          onClick={() =>
            sendMessage(
              activeLead
                ? `Read the current conversation for ${activeLead.first_name} ${activeLead.last_name} and draft the best next reply.`
                : 'I have no active lead selected. Tell me what you need to draft a reply.'
            )
          }
          disabled={isSending}
          className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          Draft Reply
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
        {turns.map((turn, idx) => (
          <div key={idx} className={turn.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-[95%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                turn.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              {turn.content}
            </div>

            {turn.role === 'assistant' && turn.actions?.leadRanking && turn.actions.leadRanking.leads.length > 0 && (
              <div className="mt-2 space-y-1">
                {turn.actions.leadRanking.leads.slice(0, 5).map((ranked) => (
                  <div key={ranked.leadId} className="text-xs bg-white border border-gray-200 rounded-md p-2 text-left">
                    <div className="font-medium text-gray-800">
                      {leadNameById.get(ranked.leadId) || ranked.leadId}
                      {typeof ranked.score === 'number' ? ` • Score ${ranked.score}` : ''}
                    </div>
                    <div className="text-gray-600 mt-0.5">{ranked.reason}</div>
                  </div>
                ))}
              </div>
            )}

            {turn.role === 'assistant' && turn.actions?.draftReply && (
              <div className="mt-2 text-left bg-white border border-indigo-200 rounded-md p-2">
                <div className="text-xs font-semibold text-indigo-700">Draft Ready</div>
                <div className="text-xs text-gray-600 mt-1">
                  {turn.actions.draftReply.subject
                    ? `Subject: ${turn.actions.draftReply.subject}`
                    : 'LinkedIn draft'}
                </div>
                <div className="text-xs text-gray-700 mt-1">{turn.actions.draftReply.content.slice(0, 180)}{turn.actions.draftReply.content.length > 180 ? '...' : ''}</div>
                <button
                  onClick={() => onUseDraft(turn.actions!.draftReply!)}
                  className="mt-2 text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Use Draft In Composer
                </button>
              </div>
            )}
          </div>
        ))}
        {isSending && <div className="text-xs text-gray-500">Thinking...</div>}
      </div>

      <div className="p-3 border-t border-gray-200 bg-white">
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            rows={2}
            placeholder="Ask Claude about leads, prioritization, or reply drafting..."
            className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isSending}
            className="self-end px-3 py-2 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
