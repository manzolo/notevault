'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/common/Button';

interface Props {
  onUpload: (file: File, tagIds: number[]) => Promise<void>;
}

export default function AttachmentUploadForm({ onUpload }: Props) {
  const t = useTranslations('attachments');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_BYTES = 10 * 1024 * 1024;

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
      await onUpload(file, []);
      setFile(null);
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('selectFile')}</label>
        <input
          ref={inputRef}
          type="file"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
        <p className="text-xs text-gray-400 mt-1">{t('maxSize')}</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={uploading} disabled={!file || uploading}>
        {uploading ? t('uploading') : t('upload')}
      </Button>
    </form>
  );
}
