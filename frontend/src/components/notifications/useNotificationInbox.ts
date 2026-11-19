import { useCallback, useEffect, useState } from 'react';

export type InboxKind = 'success' | 'info' | 'warning' | 'error' | 'reminder' | 'ai';

export interface InboxItem {
  id: string;
  title: string;
  kind: InboxKind;
  at: number; // epoch ms
  read: boolean;
}

const MAX_ITEMS = 100;
const keyFor = (email: string) => `renim_inbox_${(email || 'guest').trim().toLowerCase()}`;

const load = (email: string): InboxItem[] => {
  try {
    const raw = localStorage.getItem(keyFor(email));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
};

/** Picks a friendlier category from a toast message so the inbox can show a fitting icon. */
export const classifyMessage = (message: string, type: 'success' | 'info' | 'warning' | 'error'): InboxKind => {
  if (/reminder|starts at/i.test(message)) return 'reminder';
  if (type === 'success' && /\bAI\b|summar|subtask|draft|transcri|indexed|enhance/i.test(message)) return 'ai';
  return type;
};

/** Per-user notification history kept in this browser (latest first, capped at 100). */
export function useNotificationInbox(userEmail: string) {
  const [state, setState] = useState<{ email: string | null; items: InboxItem[] }>({ email: null, items: [] });
  const items = state.email === userEmail ? state.items : [];

  useEffect(() => {
    setState({ email: userEmail, items: load(userEmail) });
  }, [userEmail]);

  useEffect(() => {
    if (state.email === null) return;
    try {
      localStorage.setItem(keyFor(state.email), JSON.stringify(state.items));
    } catch {}
  }, [state]);

  const setItems = useCallback((fn: (prev: InboxItem[]) => InboxItem[]) => {
    setState((s) => (s.email === null ? s : { email: s.email, items: fn(s.items) }));
  }, []);

  const add = useCallback((title: string, kind: InboxKind) => {
    const text = (title || '').trim();
    if (!text) return;
    setItems((prev) => {
      // Skip exact repeats that arrive within a few seconds (e.g. reminder checks).
      const last = prev[0];
      if (last && last.title === text && Date.now() - last.at < 5000) return prev;
      const item: InboxItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: text, kind, at: Date.now(), read: false };
      return [item, ...prev].slice(0, MAX_ITEMS);
    });
  }, [setItems]);

  const markAllRead = useCallback(() => setItems((prev) => prev.map((i) => (i.read ? i : { ...i, read: true }))), [setItems]);
  const markRead = useCallback((id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i))), [setItems]);
  const clearAll = useCallback(() => setItems(() => []), [setItems]);

  const unreadCount = items.reduce((n, i) => n + (i.read ? 0 : 1), 0);
  return { items, unreadCount, add, markAllRead, markRead, clearAll };
}
