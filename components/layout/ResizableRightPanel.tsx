'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

interface ResizableRightPanelProps {
  children: ReactNode;
  storageKey?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export default function ResizableRightPanel({
  children,
  storageKey = 'leadfeed_ai_panel_width',
  defaultWidth = 380,
  minWidth = 320,
  maxWidth = 560,
}: ResizableRightPanelProps) {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultWidth;
    const saved = window.localStorage.getItem(storageKey);
    const parsed = Number(saved);
    if (Number.isFinite(parsed)) {
      return Math.min(maxWidth, Math.max(minWidth, parsed));
    }
    return defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef(0);
  const startWidthRef = useRef(defaultWidth);

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isResizing) return;
      const deltaX = resizeStartXRef.current - event.clientX;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + deltaX));
      setWidth(nextWidth);
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
    };
  }, [isResizing, minWidth, maxWidth]);

  return (
    <div className="h-full shrink-0 border-l border-gray-200 bg-white relative" style={{ width }}>
      <button
        type="button"
        aria-label="Resize AI panel"
        onPointerDown={(event) => {
          resizeStartXRef.current = event.clientX;
          startWidthRef.current = width;
          setIsResizing(true);
        }}
        className={`absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize ${
          isResizing ? 'bg-indigo-300' : 'bg-transparent hover:bg-indigo-200'
        }`}
      />
      <div className="h-full">{children}</div>
    </div>
  );
}
