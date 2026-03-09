'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { Category } from '@/lib/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Category[]>('/api/categories');
      setCategories(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCategory = useCallback(async (name: string, parentId?: number | null) => {
    const res = await api.post<Category>('/api/categories', { name, parent_id: parentId ?? null });
    return res.data;
  }, []);

  const updateCategory = useCallback(async (id: number, data: { name?: string; parent_id?: number | null }) => {
    const res = await api.patch<Category>(`/api/categories/${id}`, data);
    return res.data;
  }, []);

  const deleteCategory = useCallback(async (id: number) => {
    await api.delete(`/api/categories/${id}`);
  }, []);

  // Flatten tree to list with depth info
  const flattenCategories = useCallback((cats: Category[], depth = 0): Array<Category & { depth: number }> => {
    const result: Array<Category & { depth: number }> = [];
    for (const cat of cats) {
      result.push({ ...cat, depth });
      if (cat.children?.length) {
        result.push(...flattenCategories(cat.children, depth + 1));
      }
    }
    return result;
  }, []);

  return { categories, loading, error, fetchCategories, createCategory, updateCategory, deleteCategory, flattenCategories };
}
