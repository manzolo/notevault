'use client';

import { useTranslations } from 'next-intl';
import { Note } from '@/lib/types';
import NoteCard from './NoteCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface NoteListProps {
  notes: Note[];
  loading: boolean;
  onDelete: (id: number) => void;
}

export default function NoteList({ notes, loading, onDelete }: NoteListProps) {
  const t = useTranslations('notes');

  if (loading) return <LoadingSpinner className="py-12" />;
  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">{t('noNotes')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onDelete={onDelete} />
      ))}
    </div>
  );
}
