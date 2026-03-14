'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/common/Button';
import { Tag } from '@/lib/types';
import { useServerConfig } from '@/hooks/useServerConfig';

interface Props {
  onUpload: (file: File, tagIds: number[], description?: string) => Promise<void>;
  onComplete?: (count: number) => void;
  availableTags?: Tag[];
  initialFiles?: File[];
}

export default function AttachmentUploadForm({ onUpload, onComplete, availableTags = [], initialFiles }: Props) {
  const t = useTranslations('attachments');
  const { max_upload_bytes } = useServerConfig();
  const MAX_BYTES = max_upload_bytes;
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [description, setDescription] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;
    const oversized = files.filter((f) => f.size > MAX_BYTES);
    if (oversized.length > 0) {
      setError(`${oversized[0].name}: ${t('fileTooLarge')}`);
      return;
    }
    setError(null);
    setUploading(true);
    const total = files.length;
    try {
      for (let i = 0; i < total; i++) {
        setUploadProgress({ current: i + 1, total });
        await onUpload(files[i], selectedTagIds, description || undefined);
      }
      setFiles([]);
      setDescription('');
      setSelectedTagIds([]);
      if (inputRef.current) inputRef.current.value = '';
      onComplete?.(total);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 413) setError(t('fileTooLarge'));
      else if (status === 415) setError(t('unsupportedType'));
      else setError(err?.response?.data?.detail ?? 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const uploadButtonLabel = () => {
    if (!uploading) return t('upload');
    if (uploadProgress && uploadProgress.total > 1) {
      return `${t('uploading')} ${uploadProgress.current}/${uploadProgress.total}`;
    }
    return t('uploading');
  };

  const FileItem = ({ file }: { file: File }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-sm">
      <svg className="h-4 w-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      <span className="text-indigo-700 dark:text-indigo-300 font-medium truncate">{file.name}</span>
      <span className="text-indigo-400 shrink-0 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('selectFile')}</label>
        {initialFiles && initialFiles.length > 0 ? (
          <div className="space-y-1">
            {files.map((f, i) => <FileItem key={i} file={f} />)}
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              required={files.length === 0}
            />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => <FileItem key={i} file={f} />)}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Max {Math.round(MAX_BYTES / 1024 / 1024)} MB</p>
          </>
        )}
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
      <Button variant="secondary" type="submit" loading={uploading} disabled={files.length === 0 || uploading}>
        {uploadButtonLabel()}
      </Button>
    </form>
  );
}
