'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchState, wsUrl, type GameState } from './api';

export type Connection = 'connecting' | 'live' | 'polling' | 'down';

interface Message {
  type: string;
  payload: unknown;
}

/**
 * Subscribes to the game server.
 *
 * Prefers the WebSocket so every ball lands the moment it is drawn. If the
 * socket can't be established (proxy, corp network, server asleep) it quietly
 * falls back to polling so the room still works, just less snappy.
 */
export function useGame(): {
  state: GameState | null;
  connection: Connection;
  error: string | null;
  refresh: () => void;
} {
  const [state, setState] = useState<GameState | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const closedRef = useRef(false);

  const refresh = useCallback(() => {
    fetchState()
      .then((next) => {
        setState(next);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setConnection('polling');
    refresh();
    pollRef.current = setInterval(refresh, 1500);
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (closedRef.current) return;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl());
    } catch {
      startPolling();
      return;
    }
    socketRef.current = socket;

    // If the socket hasn't opened quickly, start polling in parallel so the
    // page is never blank while we wait on a cold Railway container.
    const openTimeout = setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) startPolling();
    }, 2500);

    socket.onopen = () => {
      clearTimeout(openTimeout);
      attemptsRef.current = 0;
      stopPolling();
      setConnection('live');
      setError(null);
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      let msg: Message;
      try {
        msg = JSON.parse(event.data) as Message;
      } catch {
        return;
      }
      if (msg.type === 'state' || msg.type === 'settled') {
        setState(msg.payload as GameState);
      }
    };

    socket.onerror = () => {
      // onclose always follows; reconnect logic lives there.
    };

    socket.onclose = () => {
      clearTimeout(openTimeout);
      socketRef.current = null;
      if (closedRef.current) return;

      startPolling();
      attemptsRef.current += 1;
      // 1s, 2s, 4s … capped at 15s.
      const delay = Math.min(15_000, 1000 * 2 ** Math.min(attemptsRef.current - 1, 4));
      retryRef.current = setTimeout(connect, delay);
      if (attemptsRef.current > 6) setConnection('down');
    };
  }, [startPolling, stopPolling]);

  useEffect(() => {
    closedRef.current = false;
    refresh();
    connect();

    return () => {
      closedRef.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      stopPolling();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect, refresh, stopPolling]);

  return { state, connection, error, refresh };
}

/** Ticking `Date.now()`, for countdowns. Re-renders on an interval. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Persisted wallet, so a refresh keeps you at the table. */
export function useStoredWallet(): [string | null, (wallet: string | null) => void] {
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    try {
      setWallet(window.localStorage.getItem('bingo.wallet'));
    } catch {
      /* private mode — just play without persistence */
    }
  }, []);

  const update = useCallback((next: string | null) => {
    setWallet(next);
    try {
      if (next) window.localStorage.setItem('bingo.wallet', next);
      else window.localStorage.removeItem('bingo.wallet');
    } catch {
      /* ignore */
    }
  }, []);

  return [wallet, update];
}
