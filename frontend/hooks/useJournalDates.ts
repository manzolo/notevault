'use client';

import { useCallback, useState } from 'react';
import { useNotes } from '@/hooks/useNotes';

export function useJournalDates(month: string) {
  const { getJournalDates } = useNotes();
  const [journalDates, setJournalDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJournalDates = useCallback(async () => {
    setLoading(true);
    try {
      const dates = await getJournalDates(month);
      setJournalDates(dates);
    } catch {
      setJournalDates([]);
    } finally {
      setLoading(false);
    }
  }, [getJournalDates, month]);

  return { journalDates, loading, fetchJournalDates };
}
