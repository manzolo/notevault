'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/common/Button';
import { Tag } from '@/lib/types';

interface Props {
  onUpload: (file: File, tagIds: number[], description?: string) => Promise<void>;
  onComplete?: () => void;
  availableTags?: Tag[];
}

export default function TextFileCreateForm({ onUpload, onComplete, availableTags = [] }: Props) {
  const t = useTranslations('attachments');
  const [filename, setFilename] = useState('file.txt');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = filename.trim() || 'file.txt';
    const blob = new Blob([content], { type: 'text/plain' });
    const file = new File([blob], name, { type: 'text/plain' });
    setError(null);
    setSaving(true);
    try {
      await onUpload(file, selectedTagIds, description || undefined);
      setFilename('file.txt');
      setContent('');
      setDescription('');
      setSelectedTagIds([]);
      onComplete?.();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 415) setError(t('unsupportedType'));
      else setError(err?.response?.data?.detail ?? 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('textFileName')}
        </label>
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="file.txt"
          className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('textFileContent')}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('textFileContentPlaceholder')}
          rows={10}
          className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('description')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
          rows={2}
          className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      {availableTags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tags')}</label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button variant="secondary" type="submit" loading={saving} disabled={saving}>
        {saving ? t('uploading') : t('textFileCreate')}
      </Button>
    </form>
  );
}
