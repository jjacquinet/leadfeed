'use client';

import { Lead, LeadStage } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import LeadStageSelector from '@/components/leads/LeadStageSelector';
import SnoozePopover from '@/components/snooze/SnoozePopover';
import { formatDateTime } from '@/lib/utils';

interface DetailPanelProps {
  lead: Lead | null;
  onStageChange: (leadId: string, stage: LeadStage) => void;
  onSnooze: (leadId: string, until: Date) => void;
  onUnsnooze: (leadId: string) => void;
}

function DetailField({ label, value, isLink }: { label: string; value?: string | null; isLink?: boolean }) {
  if (!value) return null;
  return (
    <div className="py-2">
      <dt className="text-xs text-gray-400 font-medium">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5">
        {isLink ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 hover:underline break-all"
          >
            {value.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export default function DetailPanel({ lead, onStageChange, onSnooze, onUnsnooze }: DetailPanelProps) {
  if (!lead) {
    return (
      <div className="w-[320px] bg-white border-l border-gray-200 shrink-0" />
    );
  }

  return (
    <div className="w-[320px] bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-y-auto">
      {/* Contact Card Header */}
      <div className="px-5 py-5 border-b border-gray-100 text-center">
        <div className="flex justify-center mb-3">
          <Avatar firstName={lead.first_name} lastName={lead.last_name} size="lg" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          {lead.first_name} {lead.last_name}
        </h3>
        {lead.title && <p className="text-sm text-gray-500">{lead.title}</p>}
        {lead.company && <p className="text-sm text-gray-400">{lead.company}</p>}
      </div>

      {/* Contact Information */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contact Information</h4>
        <dl className="divide-y divide-gray-50">
          <DetailField label="First Name" value={lead.first_name} />
          <DetailField label="Last Name" value={lead.last_name} />
          <DetailField label="Title / Role" value={lead.title} />
          <DetailField label="Company" value={lead.company} />
          <DetailField label="LinkedIn" value={lead.linkedin_url} isLink />
          <DetailField label="Website" value={lead.company_website} isLink />
          <DetailField label="Email" value={lead.email} />
          <DetailField label="Phone" value={lead.phone} />
        </dl>
      </div>

      {/* Stage */}
      <div className="px-5 py-4 border-b border-gray-100">
        <LeadStageSelector
          currentStage={lead.stage}
          onChange={(stage) => onStageChange(lead.id, stage)}
        />
      </div>

      {/* Snooze */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Snooze</h4>
        <SnoozePopover
          isSnoozed={lead.stage === 'snoozed'}
          snoozedUntil={lead.snoozed_until}
          onSnooze={(until) => onSnooze(lead.id, until)}
          onUnsnooze={() => onUnsnooze(lead.id)}
        />
      </div>

      {/* Source & Dates */}
      <div className="px-5 py-4">
        {(lead.source || lead.campaign_name) && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Source</h4>
            {lead.campaign_name && (
              <span className="inline-block px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md">
                {lead.campaign_name}
              </span>
            )}
            {lead.source && (
              <span className="inline-block px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-md ml-1">
                {lead.source === 'getsales_webhook' ? 'GetSales.io' : lead.source}
              </span>
            )}
          </div>
        )}
        <div className="space-y-2">
          <div>
            <span className="text-xs text-gray-400">Created</span>
            <p className="text-xs text-gray-600">{formatDateTime(lead.created_at)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-400">Last Activity</span>
            <p className="text-xs text-gray-600">{formatDateTime(lead.last_activity)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
