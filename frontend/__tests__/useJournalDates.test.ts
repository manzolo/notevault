jest.mock('@/hooks/useNotes', () => ({ useNotes: jest.fn() }));

import { renderHook, act } from '@testing-library/react';
import { useNotes } from '@/hooks/useNotes';
import { useJournalDates } from '@/hooks/useJournalDates';

describe('useJournalDates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchJournalDates carica le date del mese richiesto', async () => {
    const getJournalDates = jest.fn().mockResolvedValue(['2026-04-01', '2026-04-15']);
    (useNotes as jest.Mock).mockReturnValue({ getJournalDates });

    const { result } = renderHook(() => useJournalDates('2026-04'));

    await act(async () => {
      await result.current.fetchJournalDates();
    });

    expect(getJournalDates).toHaveBeenCalledWith('2026-04');
    expect(result.current.journalDates).toEqual(['2026-04-01', '2026-04-15']);
    expect(result.current.loading).toBe(false);
  });
});
