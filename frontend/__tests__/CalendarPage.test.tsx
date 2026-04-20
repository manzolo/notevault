jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ locale: 'en' }),
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
  useAllTasks: () => ({
    tasks: [
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
    ],
    fetchAllTasks,
  }),
}));

jest.mock('@/hooks/useFieldDates', () => ({
  useFieldDates: () => ({ fieldDates: [], fetchFieldDates }),
}));

jest.mock('@/hooks/useJournalDates', () => ({
  useJournalDates: () => ({ journalDates: [], fetchJournalDates }),
}));

jest.mock('@/hooks/useNotes', () => ({
  useNotes: () => ({ createDailyNote }),
}));

import { render, screen } from '@testing-library/react';
import CalendarPage from '@/app/[locale]/calendar/page';

describe('CalendarPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('non mostra i task completati nel calendario', () => {
    render(<CalendarPage />);

    expect(screen.getByText('Visible task')).toBeInTheDocument();
    expect(screen.queryByText('Completed task')).not.toBeInTheDocument();
  });
});
