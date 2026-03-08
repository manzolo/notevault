'use client';

import { Tag } from '@/lib/types';
import { useTranslations } from 'next-intl';

interface TagFilterProps {
  tags: Tag[];
  selectedTagId: number | null;
  onSelect: (tagId: number | null) => void;
}

export default function TagFilter({ tags, selectedTagId, onSelect }: TagFilterProps) {
  const t = useTranslations('notes');

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1 text-xs rounded-full transition-colors ${
          selectedTagId === null
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => onSelect(tag.id)}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            selectedTagId === tag.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {tag.name}
        </button>
      ))}
    </div>
  );
}
