jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    confirmInput: jest.fn().mockResolvedValue({ confirmed: false }),
    dialog: null,
  }),
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AttachmentFolderView from '@/components/attachments/AttachmentFolderView';
import { Attachment, AttachmentFolder } from '@/lib/types';

const folder: AttachmentFolder = {
  id: 1, name: 'Contracts', note_id: 7, parent_id: null, position: 0,
  attachment_count: 1, children: [], created_at: '', updated_at: '',
};

const att = (id: number, filename: string, folder_id: number | null): Attachment => ({
  id, note_id: 7, folder_id, filename, mime_type: 'application/pdf',
  size_bytes: 1024, position: 0, is_archived: false, tags: [],
  created_at: '2024-01-01', updated_at: '2024-01-01',
});

function setup(props: Partial<React.ComponentProps<typeof AttachmentFolderView>> = {}) {
  const handlers = {
    onPreview: jest.fn(), onDownload: jest.fn(), onDelete: jest.fn(), onEdit: jest.fn(),
    onMoveAttachment: jest.fn(), onCreateFolder: jest.fn(), onRenameFolder: jest.fn(),
    onDeleteFolder: jest.fn(), onMoveFolder: jest.fn(), onDownloadFolder: jest.fn(),
    onReorderFolders: jest.fn(), onReorder: jest.fn(), setAttachments: jest.fn(),
  };
  render(
    <AttachmentFolderView
      attachments={[att(10, 'Ordine.pdf', 1), att(11, 'free.pdf', null)]}
      folders={[folder]}
      loading={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe('AttachmentFolderView', () => {
  it('parte con le cartelle chiuse: mostra cartella e file senza cartella, non i file dentro', () => {
    setup();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
    expect(screen.getByText('free.pdf')).toBeInTheDocument(); // unfiled, sempre visibile
    expect(screen.getByText('unfiled')).toBeInTheDocument();
    // La cartella è chiusa di default → il file dentro non è renderizzato
    expect(screen.queryByText('Ordine.pdf')).not.toBeInTheDocument();
  });

  it('clic sulla cartella ne rivela il contenuto', () => {
    setup();
    fireEvent.click(screen.getByText('Contracts'));
    expect(screen.getByText('Ordine.pdf')).toBeInTheDocument();
  });

  it('crea una cartella radice dal pulsante', async () => {
    const h = setup();
    fireEvent.click(screen.getByText('newFolder'));
    const input = screen.getByPlaceholderText('folderNamePlaceholder');
    fireEvent.change(input, { target: { value: 'Invoices' } });
    await act(async () => { fireEvent.submit(input.closest('form')!); });
    expect(h.onCreateFolder).toHaveBeenCalledWith('Invoices', null);
  });

  it('elimina una cartella dopo conferma', async () => {
    const h = setup();
    // The folder delete button is the first "delete"-titled control in DOM order
    // (folder header renders before its attachments).
    fireEvent.click(screen.getAllByTitle('delete')[0]);
    await waitFor(() => expect(h.onDeleteFolder).toHaveBeenCalledWith(1));
  });
});
