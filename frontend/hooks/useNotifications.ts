'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { AppNotification } from '@/lib/types';

const POLL_INTERVAL = 30_000;

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get<{ unread: number }>('/api/notifications/count');
      setUnreadCount(res.data.unread);
    } catch {
      // silently ignore polling errors
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await api.get<AppNotification[]>('/api/notifications');
      setNotifications(res.data);
      setUnreadCount(res.data.filter((n) => !n.is_read).length);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const markRead = useCallback(async (id: number) => {
    await api.post(`/api/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await api.post('/api/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  const snoozeNotification = useCallback(async (id: number, minutes: number) => {
    await api.post(`/api/notifications/${id}/snooze`, { minutes });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  useEffect(() => {
    fetchCount();
    timerRef.current = setInterval(fetchCount, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCount]);

  return { unreadCount, notifications, loadingList, fetchNotifications, markRead, markAllRead, snoozeNotification };
}
