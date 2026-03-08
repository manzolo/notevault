jest.mock('@/lib/api', () => ({ get: jest.fn(), post: jest.fn() }));
import { renderHook, act } from '@testing-library/react';
import api from '@/lib/api';
import { useTags } from '@/hooks/useTags';

describe('useTags', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetchTags popola tags state', async () => {
    const mockTags = [{ id: 1, name: 'alpha', user_id: 1, created_at: '2024-01-01' }];
    (api.get as jest.Mock).mockResolvedValue({ data: mockTags });
    const { result } = renderHook(() => useTags());
    await act(async () => { await result.current.fetchTags(); });
    expect(result.current.tags).toEqual(mockTags);
    expect(result.current.loading).toBe(false);
  });

  it('createTag aggiunge tag in ordine alfabetico', async () => {
    const existing = { id: 1, name: 'zebra', user_id: 1, created_at: '2024-01-01' };
    const newTag = { id: 2, name: 'apple', user_id: 1, created_at: '2024-01-02' };
    (api.get as jest.Mock).mockResolvedValue({ data: [existing] });
    (api.post as jest.Mock).mockResolvedValue({ data: newTag });
    const { result } = renderHook(() => useTags());
    await act(async () => { await result.current.fetchTags(); });
    await act(async () => { await result.current.createTag('apple'); });
    expect(result.current.tags[0].name).toBe('apple');
    expect(result.current.tags).toHaveLength(2);
  });

  it('createTag non duplica se endpoint è idempotente', async () => {
    const existing = { id: 1, name: 'dup', user_id: 1, created_at: '2024-01-01' };
    (api.get as jest.Mock).mockResolvedValue({ data: [existing] });
    (api.post as jest.Mock).mockResolvedValue({ data: existing });
    const { result } = renderHook(() => useTags());
    await act(async () => { await result.current.fetchTags(); });
    await act(async () => { await result.current.createTag('dup'); });
    expect(result.current.tags).toHaveLength(1);
  });
});
