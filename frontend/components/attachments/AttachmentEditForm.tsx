'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/common/Button';
import { Attachment, Tag } from '@/lib/types';

interface Props {
  attachment: Attachment;
  availableTags?: Tag[];
  onSave: (data: { filename?: string; description?: string; tag_ids: number[] }) => Promise<void>;
  onCancel: () => void;
}

export default function AttachmentEditForm({ attachment, availableTags = [], onSave, onCancel }: Props) {
  const t = useTranslations('attachments');
  const tCommon = useTranslations('common');
  const [filename, setFilename] = useState(attachment.filename);
  const [description, setDescription] = useState(attachment.description ?? '');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(attachment.tags.map((tag) => tag.id));
  const [saving, setSaving] = useState(false);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim()) return;
    setSaving(true);
    try {
      await onSave({
        filename: filename.trim() !== attachment.filename ? filename.trim() : undefined,
        description: description || undefined,
        tag_ids: selectedTagIds,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('fileName')}
        </label>
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          required
          className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-gray-100"
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

      <div className="flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={saving}>
          {tCommon('cancel')}
        </Button>
        <Button variant="secondary" type="submit" loading={saving} disabled={saving}>
          {tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
