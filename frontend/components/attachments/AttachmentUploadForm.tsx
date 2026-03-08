'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/common/Button';
import { Tag } from '@/lib/types';

interface Props {
  onUpload: (file: File, tagIds: number[], description?: string) => Promise<void>;
  availableTags?: Tag[];
}

export default function AttachmentUploadForm({ onUpload, availableTags = [] }: Props) {
  const t = useTranslations('attachments');
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_BYTES = 10 * 1024 * 1024;

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(t('fileTooLarge'));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await onUpload(file, selectedTagIds, description || undefined);
      setFile(null);
      setDescription('');
      setSelectedTagIds([]);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 413) setError(t('fileTooLarge'));
      else if (status === 415) setError(t('unsupportedType'));
      else setError(err?.response?.data?.detail ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('selectFile')}</label>
        <input
          ref={inputRef}
          type="file"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
        <p className="text-xs text-gray-400 mt-1">{t('maxSize')}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('descriptionPlaceholder')}
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
      <Button type="submit" loading={uploading} disabled={!file || uploading}>
        {uploading ? t('uploading') : t('upload')}
      </Button>
    </form>
  );
}
