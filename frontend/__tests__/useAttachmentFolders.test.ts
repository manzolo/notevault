jest.mock('@/lib/api', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
import { renderHook, act } from '@testing-library/react';
import api from '@/lib/api';
import { useAttachmentFolders } from '@/hooks/useAttachmentFolders';

describe('useAttachmentFolders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetchFolders popola lo stato e usa il path scoped per nota', async () => {
    const tree = [{ id: 1, name: 'Docs', note_id: 7, parent_id: null, position: 0, attachment_count: 0, children: [], created_at: '', updated_at: '' }];
    (api.get as jest.Mock).mockResolvedValue({ data: tree });
    const { result } = renderHook(() => useAttachmentFolders(7));
    await act(async () => { await result.current.fetchFolders(); });
    expect(api.get).toHaveBeenCalledWith('/api/notes/7/attachment-folders');
    expect(result.current.folders).toEqual(tree);
  });

  it('createFolder invia name e parent_id', async () => {
    const created = { id: 2, name: 'Sub', note_id: 7, parent_id: 1, position: 0, attachment_count: 0, children: [], created_at: '', updated_at: '' };
    (api.post as jest.Mock).mockResolvedValue({ data: created });
    const { result } = renderHook(() => useAttachmentFolders(7));
    let ret: any;
    await act(async () => { ret = await result.current.createFolder('Sub', 1); });
    expect(api.post).toHaveBeenCalledWith('/api/notes/7/attachment-folders', { name: 'Sub', parent_id: 1 });
    expect(ret).toEqual(created);
  });

  it('updateFolder fa il PATCH sul folder id', async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useAttachmentFolders(7));
    await act(async () => { await result.current.updateFolder(2, { parent_id: null }); });
    expect(api.patch).toHaveBeenCalledWith('/api/notes/7/attachment-folders/2', { parent_id: null });
  });

  it('deleteFolder fa la DELETE sul folder id', async () => {
    (api.delete as jest.Mock).mockResolvedValue({});
    const { result } = renderHook(() => useAttachmentFolders(7));
    await act(async () => { await result.current.deleteFolder(2); });
    expect(api.delete).toHaveBeenCalledWith('/api/notes/7/attachment-folders/2');
  });

  it('reorderFolders fa il PATCH su /reorder con la lista', async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: { ok: true } });
    const { result } = renderHook(() => useAttachmentFolders(7));
    const items = [{ id: 2, position: 0, parent_id: null }, { id: 3, position: 1, parent_id: null }];
    await act(async () => { await result.current.reorderFolders(items); });
    expect(api.patch).toHaveBeenCalledWith('/api/notes/7/attachment-folders/reorder', items);
  });

  it('flattenFolders appiattisce con depth', () => {
    const { result } = renderHook(() => useAttachmentFolders(7));
    const tree = [
      { id: 1, name: 'A', note_id: 7, parent_id: null, attachment_count: 0, created_at: '', updated_at: '', children: [
        { id: 2, name: 'B', note_id: 7, parent_id: 1, attachment_count: 0, created_at: '', updated_at: '', children: [] },
      ] },
    ];
    const flat = result.current.flattenFolders(tree as any);
    expect(flat.map((f) => [f.id, f.depth])).toEqual([[1, 0], [2, 1]]);
  });
});
