'use client';

import { useCallback, useState } from 'react';
import api from '@/lib/api';
import { EventReminder } from '@/lib/types';

export interface EventReminderCreate {
  minutes_before: number;
  notify_in_app: boolean;
  notify_telegram: boolean;
  notify_email: boolean;
}

export function useEventReminders(eventId: number) {
  const [reminders, setReminders] = useState<EventReminder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<EventReminder[]>(`/api/events/${eventId}/reminders`);
      setReminders(res.data);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const createReminder = useCallback(
    async (data: EventReminderCreate): Promise<EventReminder> => {
      const res = await api.post<EventReminder>(`/api/events/${eventId}/reminders`, data);
      setReminders((prev) => [...prev, res.data].sort((a, b) => a.minutes_before - b.minutes_before));
      return res.data;
    },
    [eventId],
  );

  const deleteReminder = useCallback(
    async (reminderId: number): Promise<void> => {
      await api.delete(`/api/events/${eventId}/reminders/${reminderId}`);
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    },
    [eventId],
  );

  return { reminders, loading, fetchReminders, createReminder, deleteReminder };
}
