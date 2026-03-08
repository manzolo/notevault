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
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPage, setSearchPage] = useState(1);

  const PER_PAGE = 20;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

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

  const doSearch = async (query: string, pg: number) => {
    if (!query) return;
    const response = await api.get<SearchResponse>(
      `/api/search?q=${encodeURIComponent(query)}&page=${pg}&per_page=20`
    );
    setSearchResults(response.data);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setSearchPage(1);
    await doSearch(query, 1);
  };

  const handleSearchPageChange = async (pg: number) => {
    setSearchPage(pg);
    await doSearch(searchQuery, pg);
  };

  const handleDelete = async (id: number) => {
    await deleteNote(id);
    fetchNotes(page);
  };

  if (authLoading) return null;
  if (!user) return null;

  const displayNotes = searchResults ? searchResults.items : notes;
  const displayLoading = loading && !searchResults;

  const matchMap = searchResults
    ? new Map(
        searchResults.items.map((item) => [
          item.id,
          { attachment: item.match_in_attachment ?? false, bookmark: item.match_in_bookmark ?? false },
        ])
      )
    : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{t('myNotes')}</h1>
        <Link href={`/${locale}/notes/new`}>
          <Button>{t('newNote')}</Button>
        </Link>
      </div>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} />
        {searchResults && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2">
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              {searchResults.total} results for &ldquo;{searchResults.query}&rdquo;
            </p>
            <button
              onClick={() => { setSearchResults(null); setSearchQuery(''); setSearchPage(1); }}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      <NoteList notes={displayNotes} loading={displayLoading} onDelete={handleDelete} matchMap={matchMap} />

      {searchResults ? (
        <Pagination page={searchPage} pages={searchResults.pages} onPageChange={handleSearchPageChange} />
      ) : (
        <Pagination page={page} pages={pages} onPageChange={setPage} />
      )}
    </div>
  );
}
