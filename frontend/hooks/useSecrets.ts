'use client';

import { useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { Secret, SecretCreate, SecretReveal } from '@/lib/types';
import { copyToClipboard } from '@/lib/utils';
import { useArchivable } from '@/hooks/useArchivable';

const AUTO_HIDE_SECONDS = 30;

export function useSecrets(noteId: number) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [revealedSecrets, setRevealedSecrets] = useState<Map<number, SecretReveal>>(new Map());
  const [countdown, setCountdown] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const timers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  const fetchSecrets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<Secret[]>(`/api/notes/${noteId}/secrets`);
      setSecrets(response.data);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  const createSecret = useCallback(async (data: SecretCreate): Promise<Secret> => {
    const response = await api.post<Secret>(`/api/notes/${noteId}/secrets`, data);
    setSecrets((prev) => [...prev, response.data]);
    return response.data;
  }, [noteId]);

  const revealSecret = useCallback(async (secretId: number): Promise<void> => {
    const response = await api.post<SecretReveal>(`/api/notes/${noteId}/secrets/${secretId}/reveal`);
    const revealed = response.data;

    setRevealedSecrets((prev) => new Map(prev).set(secretId, revealed));
    setCountdown((prev) => new Map(prev).set(secretId, AUTO_HIDE_SECONDS));

    // Auto-hide after 30 seconds
    let seconds = AUTO_HIDE_SECONDS;
    const interval = setInterval(() => {
      seconds -= 1;
      setCountdown((prev) => new Map(prev).set(secretId, seconds));
      if (seconds <= 0) {
        clearInterval(interval);
        timers.current.delete(secretId);
        hideSecret(secretId);
      }
    }, 1000);

    timers.current.set(secretId, interval);
  }, [noteId]);

  const hideSecret = useCallback((secretId: number) => {
    const timer = timers.current.get(secretId);
    if (timer) {
      clearInterval(timer);
      timers.current.delete(secretId);
    }
    setRevealedSecrets((prev) => {
      const next = new Map(prev);
      next.delete(secretId);
      return next;
    });
    setCountdown((prev) => {
      const next = new Map(prev);
      next.delete(secretId);
      return next;
    });
  }, []);

  const deleteSecret = useCallback(async (secretId: number): Promise<void> => {
    await api.delete(`/api/notes/${noteId}/secrets/${secretId}`);
    hideSecret(secretId);
    setSecrets((prev) => prev.filter((s) => s.id !== secretId));
  }, [noteId, hideSecret]);

  // Reveal, copy to clipboard, and immediately hide — value never shown in UI
  const copySecret = useCallback(async (secretId: number): Promise<void> => {
    const response = await api.post<SecretReveal>(`/api/notes/${noteId}/secrets/${secretId}/reveal`);
    await copyToClipboard(response.data.value);
  }, [noteId]);

  const reorderSecrets = useCallback(async (items: { id: number; position: number }[]): Promise<void> => {
    await api.patch(`/api/notes/${noteId}/secrets/reorder`, items);
  }, [noteId]);

  const {
    archiveItem: archiveSecret,
    restoreItem: restoreSecret,
    fetchArchived: fetchArchivedSecrets,
  } = useArchivable<Secret>(
    { basePath: `/api/notes/${noteId}/secrets`, archiveSuffix: '/archive', archiveMethod: 'patch' },
    setSecrets,
  );

  return {
    secrets,
    setSecrets,
    revealedSecrets,
    countdown,
    loading,
    fetchSecrets,
    createSecret,
    revealSecret,
    hideSecret,
    deleteSecret,
    copySecret,
    reorderSecrets,
    archiveSecret,
    restoreSecret,
    fetchArchivedSecrets,
  };
}
