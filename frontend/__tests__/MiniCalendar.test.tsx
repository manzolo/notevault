jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const fetchEvents = jest.fn();
const fetchAllTasks = jest.fn();
const fetchFieldDates = jest.fn();
const fetchJournalDates = jest.fn();
const createDailyNote = jest.fn();
const mockTasks = [
  {
    id: 1,
    note_id: 10,
    user_id: 1,
    title: 'Visible task',
    is_done: false,
    due_date: '2026-04-15T09:00:00Z',
    position: 0,
    is_archived: false,
    archive_note: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    note_title: 'Work',
  },
  {
    id: 2,
    note_id: 11,
    user_id: 1,
    title: 'Completed task',
    is_done: true,
    due_date: '2026-04-15T10:00:00Z',
    position: 1,
    is_archived: false,
    archive_note: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    note_title: 'Done note',
  },
];

jest.mock('@/hooks/useEvents', () => ({
  useAllEvents: () => ({ events: [], fetchEvents }),
}));

jest.mock('@/hooks/useTasks', () => ({
  useAllTasks: () => ({ tasks: mockTasks, fetchAllTasks }),
}));

jest.mock('@/hooks/useFieldDates', () => ({
  useFieldDates: () => ({ fieldDates: [], fetchFieldDates }),
}));

jest.mock('@/hooks/useJournalDates', () => ({
  useJournalDates: () => ({ journalDates: ['2026-04-15'], fetchJournalDates }),
}));

jest.mock('@/hooks/useNotes', () => ({
  useNotes: () => ({ createDailyNote }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MiniCalendar from '@/components/calendar/MiniCalendar';

describe('MiniCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T10:00:00Z'));
    createDailyNote.mockResolvedValue({ note_id: 42, created: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renderizza il journal dot per i giorni con diario', () => {
    render(<MiniCalendar selectedDate={null} onDayClick={jest.fn()} />);

    expect(screen.getByTestId('journal-dot-15')).toBeInTheDocument();
    expect(fetchJournalDates).toHaveBeenCalled();
  });

  it('cliccando un giorno journal applica il filtro del calendario', () => {
    const onDayClick = jest.fn();
    render(<MiniCalendar selectedDate={null} onDayClick={onDayClick} />);

    fireEvent.click(screen.getByRole('button', { name: '15' }));

    expect(onDayClick).toHaveBeenCalledWith('2026-04-15');
  });

  it('con un giorno selezionato permette di aprire o creare il journal come azione secondaria', async () => {
    render(<MiniCalendar selectedDate={'2026-04-15'} onDayClick={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /2026-04-15.*openSelected/i }));

    await waitFor(() => {
      expect(createDailyNote).toHaveBeenCalledWith('2026-04-15', 'en');
      expect(push).toHaveBeenCalledWith('/en/notes/42');
    });
  });

  it('non conta i task completati nel giorno', () => {
    render(<MiniCalendar selectedDate={null} onDayClick={jest.fn()} />);

    expect(screen.getByRole('button', { name: '15' })).toHaveAttribute('title', expect.stringContaining('Visible task'));
    expect(screen.getByRole('button', { name: '15' })).not.toHaveAttribute('title', expect.stringContaining('Completed task'));
  });
});
