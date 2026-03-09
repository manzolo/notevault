'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Category, NoteCreate, NoteUpdate, Tag } from '@/lib/types';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

interface NoteEditorProps {
  initialTitle?: string;
  initialContent?: string;
  initialTagIds?: number[];
  initialCategoryId?: number | null;
  availableTags?: Tag[];
  availableCategories?: Array<Category & { depth: number }>;
  onSave: (data: NoteCreate | NoteUpdate) => Promise<void>;
  onCreateTag?: (name: string) => Promise<Tag>;
  loading?: boolean;
}

export default function NoteEditor({
  initialTitle = '',
  initialContent = '',
  initialTagIds,
  initialCategoryId = null,
  availableTags,
  availableCategories,
  onSave,
  onCreateTag,
  loading,
}: NoteEditorProps) {
  const t = useTranslations('notes');
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initialTagIds ?? []);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(initialCategoryId ?? null);
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const toggleTag = (id: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name || !onCreateTag) return;
    setCreatingTag(true);
    try {
      const created = await onCreateTag(name);
      setSelectedTagIds((prev) => prev.includes(created.id) ? prev : [...prev, created.id]);
      setNewTagName('');
    } finally {
      setCreatingTag(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ title, content, tag_ids: selectedTagIds, category_id: selectedCategoryId });
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

      {availableCategories && availableCategories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('category')}
          </label>
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">— {t('noFolder')} —</option>
            {availableCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {'  '.repeat(cat.depth)}{cat.depth > 0 ? '↳ ' : ''}{cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('content')}</label>
          <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setPreviewMode(false)}
              className={`px-3 py-1 transition-colors ${!previewMode ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {t('write')}
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(true)}
              className={`px-3 py-1 transition-colors ${previewMode ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {t('preview')}
            </button>
          </div>
        </div>
        {previewMode ? (
          <div className="min-h-[18rem] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm prose prose-sm max-w-none dark:prose-invert overflow-auto">
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-gray-400 italic">Nothing to preview.</p>
            )}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Write your note in Markdown..."
          />
        )}
      </div>

      {(availableTags && availableTags.length > 0 || onCreateTag) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('tags')}
          </label>
          {availableTags && availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {availableTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                    }`}>
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
          {onCreateTag && (
            <div className="flex gap-2 items-center">
              <input type="text" value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }}
                placeholder={t('newTag')}
                className="block flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-gray-100"
              />
              <Button type="button" variant="secondary" size="sm"
                onClick={handleCreateTag} loading={creatingTag}
                disabled={!newTagName.trim() || creatingTag}>
                {t('createTag')}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={loading}>
          {loading ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
