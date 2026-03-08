'use client';
import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Tag } from '@/lib/types';

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<Tag[]>('/api/tags');
      setTags(response.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTag = useCallback(async (name: string): Promise<Tag> => {
    const response = await api.post<Tag>('/api/tags', { name });
    setTags((prev) => {
      if (prev.some((t) => t.id === response.data.id)) return prev;
      return [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name));
    });
    return response.data;
  }, []);

  return { tags, loading, fetchTags, createTag };
}
