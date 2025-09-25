'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Action } from '@/types/chat';

type EventPayload = {
  type?: string;
  boardId?: string;
  actions?: Action[];
  [key: string]: unknown;
};

export function useBoardEvents(boardId: string, onActions: (actions: Action[], payload: EventPayload) => void) {
  const [connected, setConnected] = useState(false);
  const stopRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(1000);

  const cleanup = useCallback(() => {
    stopRef.current = true;
    setConnected(false);
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopRef.current = false;

    const connect = () => {
      const source = new EventSource(`/api/events?boardId=${encodeURIComponent(boardId)}`, { withCredentials: true });
      esRef.current = source;

      source.onopen = () => {
        setConnected(true);
        backoffRef.current = 1000;
      };

      source.onerror = () => {
        setConnected(false);
        source.close();
        if (stopRef.current) return;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
        setTimeout(connect, delay);
      };

      source.onmessage = (event) => {
        try {
          const payload: EventPayload = JSON.parse(event.data);
          if (payload?.type === 'board:update' && (!payload.boardId || payload.boardId === boardId)) {
            const actions = Array.isArray(payload.actions) ? (payload.actions as Action[]) : [];
            if (actions.length > 0) {
              onActions(actions, payload);
            }
          }
        } catch {
          // ignore malformed payloads
        }
      };
    };

    connect();

    return () => {
      cleanup();
    };
  }, [boardId, onActions, cleanup]);

  return connected;
}
