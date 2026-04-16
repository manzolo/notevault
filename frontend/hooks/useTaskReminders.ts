'use client';

import { useCallback, useState } from 'react';
import api from '@/lib/api';
import { TaskReminder } from '@/lib/types';

export interface TaskReminderCreate {
  minutes_before: number;
  notify_in_app: boolean;
  notify_telegram: boolean;
  notify_email: boolean;
}

export function useTaskReminders(taskId: number) {
  const [reminders, setReminders] = useState<TaskReminder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<TaskReminder[]>(`/api/tasks/${taskId}/reminders`);
      setReminders(res.data);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const createReminder = useCallback(
    async (data: TaskReminderCreate): Promise<TaskReminder> => {
      const res = await api.post<TaskReminder>(`/api/tasks/${taskId}/reminders`, data);
      setReminders((prev) => [...prev, res.data].sort((a, b) => a.minutes_before - b.minutes_before));
      return res.data;
    },
    [taskId],
  );

  const deleteReminder = useCallback(
    async (reminderId: number): Promise<void> => {
      await api.delete(`/api/tasks/${taskId}/reminders/${reminderId}`);
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    },
    [taskId],
  );

  return { reminders, loading, fetchReminders, createReminder, deleteReminder };
}
