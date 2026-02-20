'use client';

import { useEffect, useRef } from 'react';
import { getEcho, initializeEcho } from '@/lib/echo';
import { StyleCellUpdatedEvent } from '@/types/spreadsheet';

interface UseSpreadsheetRealtimeOptions {
  poId: number | null;
  currentUserId: number | null;
  onCellUpdate: (styleId: number, field: string, value: any) => void;
}

/**
 * Subscribe to real-time style cell updates for a PO via Laravel Echo / Reverb.
 * Ignores events from the current user (already handled via optimistic update).
 */
export function useSpreadsheetRealtime({
  poId,
  currentUserId,
  onCellUpdate,
}: UseSpreadsheetRealtimeOptions) {
  const callbackRef = useRef(onCellUpdate);
  callbackRef.current = onCellUpdate;

  useEffect(() => {
    if (!poId) return;

    let echo = getEcho();
    if (!echo) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      echo = initializeEcho(token || undefined);
    }
    if (!echo) return;

    const channel = echo.private(`po.${poId}`);

    const handler = (event: StyleCellUpdatedEvent) => {
      // Skip own updates — they're already applied optimistically
      if (event.updated_by?.id === currentUserId) return;
      callbackRef.current(event.style_id, event.field, event.value);
    };

    channel.listen('.StyleCellUpdated', handler);

    return () => {
      channel.stopListening('.StyleCellUpdated', handler);
      echo!.leave(`po.${poId}`);
    };
  }, [poId, currentUserId]);
}
