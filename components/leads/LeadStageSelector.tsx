'use client';

import { LeadStage, STAGE_LABELS } from '@/lib/types';

interface LeadStageSelectorProps {
  currentStage: LeadStage;
  onChange: (stage: LeadStage) => void;
}

const stageOptions: { value: LeadStage; label: string; color: string }[] = [
  { value: 'lead_feed', label: 'Lead Feed', color: 'bg-blue-100 text-blue-700' },
  { value: 'meeting_booked', label: 'Meeting Booked', color: 'bg-purple-100 text-purple-700' },
  { value: 'closed_won', label: 'Closed — Won', color: 'bg-green-100 text-green-700' },
  { value: 'closed_lost', label: 'Closed — Lost', color: 'bg-red-100 text-red-700' },
];

export default function LeadStageSelector({ currentStage, onChange }: LeadStageSelectorProps) {
  const currentOption = stageOptions.find(s => s.value === currentStage) || stageOptions[0];

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</label>
      <div className="relative">
        <select
          value={currentStage === 'snoozed' ? 'lead_feed' : currentStage}
          onChange={(e) => onChange(e.target.value as LeadStage)}
          className={`w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm font-medium border-0 cursor-pointer focus:ring-2 focus:ring-indigo-500 ${currentOption.color}`}
        >
          {stageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
}
