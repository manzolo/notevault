'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Bookmark, BookmarkCreate, BookmarkUpdate } from '@/lib/types';
import { useArchivable } from '@/hooks/useArchivable';

export function useBookmarks(noteId: number) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<Bookmark[]>(`/api/notes/${noteId}/bookmarks`);
      setBookmarks(response.data);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  const createBookmark = useCallback(
    async (data: BookmarkCreate): Promise<Bookmark> => {
      const response = await api.post<Bookmark>(`/api/notes/${noteId}/bookmarks`, data);
      setBookmarks((prev) => [...prev, response.data]);
      return response.data;
    },
    [noteId],
  );

  const updateBookmark = useCallback(
    async (bookmarkId: number, data: BookmarkUpdate): Promise<Bookmark> => {
      const response = await api.put<Bookmark>(
        `/api/notes/${noteId}/bookmarks/${bookmarkId}`,
        data,
      );
      setBookmarks((prev) => prev.map((b) => (b.id === bookmarkId ? response.data : b)));
      return response.data;
    },
    [noteId],
  );

  const deleteBookmark = useCallback(
    async (bookmarkId: number): Promise<void> => {
      await api.delete(`/api/notes/${noteId}/bookmarks/${bookmarkId}`);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    },
    [noteId],
  );

  const reorderBookmarks = useCallback(
    async (items: { id: number; position: number }[]): Promise<void> => {
      await api.patch(`/api/notes/${noteId}/bookmarks/reorder`, items);
    },
    [noteId],
  );

  const {
    archiveItem: archiveBookmark,
    restoreItem: restoreBookmark,
    fetchArchived: fetchArchivedBookmarks,
  } = useArchivable<Bookmark>(
    { basePath: `/api/notes/${noteId}/bookmarks`, archiveMethod: 'put' },
    setBookmarks,
  );

  return {
    bookmarks,
    setBookmarks,
    loading,
    fetchBookmarks,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    reorderBookmarks,
    archiveBookmark,
    restoreBookmark,
    fetchArchivedBookmarks,
  };
}
