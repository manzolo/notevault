'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { useNotes } from '@/hooks/useNotes';
import { useTags } from '@/hooks/useTags';
import { useCategories } from '@/hooks/useCategories';
import NoteEditor from '@/components/notes/NoteEditor';

export default function NewNotePage() {
  const t = useTranslations('notes');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategoryId = searchParams.get('category_id') ? parseInt(searchParams.get('category_id')!) : null;
  const { createNote } = useNotes();
  const { tags, fetchTags, createTag } = useTags();
  const { fetchCategories, flattenCategories, categories } = useCategories();

  useEffect(() => {
    fetchTags();
    fetchCategories();
  }, [fetchTags, fetchCategories]);

  const handleSave = async (data: any) => {
    try {
      const note = await createNote(data);
      toast.success('Note created!');
      router.push(`/${locale}/notes/${note.id}`);
    } catch {
      toast.error('Failed to create note');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('createNote')}</h1>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <NoteEditor
          onSave={handleSave}
          availableTags={tags}
          onCreateTag={createTag}
          availableCategories={flattenCategories(categories)}
          initialCategoryId={initialCategoryId}
        />
      </div>
    </div>
  );
}
