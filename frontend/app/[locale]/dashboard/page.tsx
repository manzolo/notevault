'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import NoteList from '@/components/notes/NoteList';
import SearchBar from '@/components/search/SearchBar';
import Pagination from '@/components/common/Pagination';
import Button from '@/components/common/Button';
import api from '@/lib/api';
import { SearchResponse } from '@/lib/types';

export default function DashboardPage() {
  const t = useTranslations('notes');
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { notes, total, loading, fetchNotes, deleteNote } = useNotes();
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}/login`);
    }
  }, [user, authLoading, locale, router]);

  useEffect(() => {
    if (user) {
      fetchNotes(page).then(() => {});
    }
  }, [user, page]);

  const handleDelete = async (id: number) => {
    await deleteNote(id);
    fetchNotes(page);
  };

  const handleSearch = async (query: string) => {
    const response = await api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`);
    setSearchResults(response.data);
  };

  if (authLoading) return null;
  if (!user) return null;

  const displayNotes = searchResults ? searchResults.items : notes;
  const displayLoading = loading && !searchResults;

  const matchMap = searchResults
    ? new Map(searchResults.items.map((item) => [item.id, item.match_in_attachment ?? false]))
    : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('myNotes')}</h1>
        <Link href={`/${locale}/notes/new`}>
          <Button>{t('newNote')}</Button>
        </Link>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} />
        {searchResults && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchResults.total} results for &ldquo;{searchResults.query}&rdquo;
            </p>
            <button
              onClick={() => setSearchResults(null)}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      <NoteList notes={displayNotes} loading={displayLoading} onDelete={handleDelete} matchMap={matchMap} />

      {!searchResults && (
        <Pagination page={page} pages={pages} onPageChange={setPage} />
      )}
    </div>
  );
}
