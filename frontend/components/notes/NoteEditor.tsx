'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { NoteCreate, NoteUpdate } from '@/lib/types';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

interface NoteEditorProps {
  initialTitle?: string;
  initialContent?: string;
  onSave: (data: NoteCreate | NoteUpdate) => Promise<void>;
  loading?: boolean;
}

export default function NoteEditor({ initialTitle = '', initialContent = '', onSave, loading }: NoteEditorProps) {
  const t = useTranslations('notes');
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ title, content });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('title')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="Note title..."
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('content')}</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Write your note in Markdown..."
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          {loading ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
