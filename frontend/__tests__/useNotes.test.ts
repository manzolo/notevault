jest.mock('@/lib/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));

import { renderHook, act } from '@testing-library/react';
import api from '@/lib/api';
import { useNotes } from '@/hooks/useNotes';

describe('useNotes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('createDailyNote inoltra date e locale al backend', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { note_id: 123, created: true } });

    const { result } = renderHook(() => useNotes());

    await act(async () => {
      await result.current.createDailyNote('2026-04-20', 'it');
    });

    expect(api.post).toHaveBeenCalledWith('/api/notes/daily', { date: '2026-04-20', locale: 'it' });
  });
});
