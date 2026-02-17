'use client';

import { useState, useRef, useEffect } from 'react';

interface SnoozePopoverProps {
  isSnoozed: boolean;
  snoozedUntil?: string | null;
  onSnooze: (until: Date) => void;
  onUnsnooze: () => void;
}

export default function SnoozePopover({ isSnoozed, snoozedUntil, onSnooze, onUnsnooze }: SnoozePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustom(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickSnooze = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    onSnooze(date);
    setIsOpen(false);
  };

  const handleCustomSnooze = () => {
    if (!customDate) return;
    const [year, month, day] = customDate.split('-').map(Number);
    const [hours, minutes] = customTime.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);
    onSnooze(date);
    setIsOpen(false);
    setShowCustom(false);
  };

  if (isSnoozed && snoozedUntil) {
    const snoozedDate = new Date(snoozedUntil);
    return (
      <div className="space-y-2">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span className="text-xs font-semibold text-orange-700">Snoozed</span>
          </div>
          <p className="text-xs text-orange-600">
            Until {snoozedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {snoozedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={onUnsnooze}
          className="w-full px-3 py-2 text-xs font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 transition-colors"
        >
          Unsnooze
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        Snooze
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {!showCustom ? (
            <>
              <div className="px-3 py-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase">Snooze for</span>
              </div>
              <button
                onClick={() => handleQuickSnooze(1)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                1 Day
              </button>
              <button
                onClick={() => handleQuickSnooze(2)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                2 Days
              </button>
              <button
                onClick={() => handleQuickSnooze(7)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                1 Week
              </button>
              <button
                onClick={() => setShowCustom(true)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
              >
                Custom...
              </button>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase">Custom snooze</div>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex-1 px-2 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Back
                </button>
                <button
                  onClick={handleCustomSnooze}
                  disabled={!customDate}
                  className="flex-1 px-2 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Snooze
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
