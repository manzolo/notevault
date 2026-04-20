jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: jest.fn(),
    dialog: null,
  }),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import FolderTree from '@/components/folders/FolderTree';

describe('FolderTree journal section', () => {
  it('renderizza il nodo Diario virtuale e apre la nota del giorno', () => {
    const onSelectJournal = jest.fn();
    const onOpenJournalDay = jest.fn();

    render(
      <FolderTree
        categories={[]}
        selectedCategoryId={null}
        recursive={false}
        onSelect={jest.fn()}
        onRecursiveToggle={jest.fn()}
        onCreateCategory={jest.fn() as any}
        onUpdateCategory={jest.fn() as any}
        onDeleteCategory={jest.fn() as any}
        onRefresh={jest.fn()}
        journalTree={[
          {
            year: 2026,
            months: [
              {
                month: '2026-04',
                days: [{ date: '2026-04-20', note_id: 42, title: 'Lunedi 20 Aprile 2026' }],
              },
            ],
          },
        ]}
        selectedJournalKey={null}
        onSelectJournal={onSelectJournal}
        onOpenJournalDay={onOpenJournalDay}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'journal' }));
    fireEvent.click(screen.getByRole('button', { name: '2026' }));
    fireEvent.click(screen.getByRole('button', { name: '2026-04' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lunedi 20 Aprile 2026' }));

    expect(onSelectJournal).toHaveBeenCalledWith({ key: 'journal:day:2026-04-20', date: '2026-04-20' });
    expect(onOpenJournalDay).toHaveBeenCalledWith(42);
  });
});
