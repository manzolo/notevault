'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { AttachmentFolder } from '@/lib/types';

export function useAttachmentFolders(noteId: number) {
  const [folders, setFolders] = useState<AttachmentFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/notes/${noteId}/attachment-folders`;

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AttachmentFolder[]>(base);
      setFolders(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [base]);

  const createFolder = useCallback(async (name: string, parentId?: number | null) => {
    const res = await api.post<AttachmentFolder>(base, { name, parent_id: parentId ?? null });
    return res.data;
  }, [base]);

  const updateFolder = useCallback(async (id: number, data: { name?: string; parent_id?: number | null }) => {
    const res = await api.patch<AttachmentFolder>(`${base}/${id}`, data);
    return res.data;
  }, [base]);

  const deleteFolder = useCallback(async (id: number) => {
    await api.delete(`${base}/${id}`);
  }, [base]);

  const reorderFolders = useCallback(
    async (items: { id: number; position: number; parent_id?: number | null }[]) => {
      await api.patch(`${base}/reorder`, items);
    },
    [base],
  );

  // Flatten tree to list with depth info (useful for dropdown pickers)
  const flattenFolders = useCallback((items: AttachmentFolder[], depth = 0): Array<AttachmentFolder & { depth: number }> => {
    const result: Array<AttachmentFolder & { depth: number }> = [];
    for (const folder of items) {
      result.push({ ...folder, depth });
      if (folder.children?.length) {
        result.push(...flattenFolders(folder.children, depth + 1));
      }
    }
    return result;
  }, []);

  return { folders, loading, error, fetchFolders, createFolder, updateFolder, deleteFolder, reorderFolders, flattenFolders };
}
