jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('qrcode.react', () => ({
  QRCodeSVG: () => null,
}));

const refresh = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      is_active: true,
      totp_enabled: false,
      ical_include_events: true,
      ical_include_tasks: true,
      ical_include_journal: false,
      ical_include_field_dates: false,
      created_at: '2026-04-20T00:00:00Z',
    },
    refresh,
  }),
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  setupTotp: jest.fn(),
  enableTotp: jest.fn(),
  disableTotp: jest.fn(),
  changePassword: jest.fn(),
}));

jest.mock('@/lib/api', () => ({ get: jest.fn(), patch: jest.fn(), post: jest.fn() }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '@/lib/api';
import SettingsPage from '@/app/[locale]/settings/page';

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { token: 'feed-token' } });
    (api.patch as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('salva le preferenze iCal selezionate', async () => {
    render(<SettingsPage />);

    const checkboxes = await screen.findAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(checkboxes[3]);
    fireEvent.click(screen.getByRole('button', { name: 'exportPrefsSave' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/auth/me/calendar-export', {
        ical_include_events: false,
        ical_include_tasks: true,
        ical_include_journal: true,
        ical_include_field_dates: true,
      });
      expect(refresh).toHaveBeenCalled();
    });
  });
});
