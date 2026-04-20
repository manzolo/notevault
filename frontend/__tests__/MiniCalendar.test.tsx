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

jest.mock('@/hooks/useEvents', () => ({
  useAllEvents: () => ({ events: [], fetchEvents }),
}));

jest.mock('@/hooks/useTasks', () => ({
  useAllTasks: () => ({ tasks: [], fetchAllTasks }),
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
});
