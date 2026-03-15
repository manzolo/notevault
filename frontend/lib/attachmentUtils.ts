export type MimeCategory =
  | 'images'
  | 'video'
  | 'pdf'
  | 'documents'
  | 'spreadsheets'
  | 'presentations'
  | 'markdown'
  | 'archives'
  | 'emails'
  | 'scripts'
  | 'executables'
  | 'other';

export const CATEGORY_ORDER: MimeCategory[] = [
  'images', 'pdf', 'video', 'documents', 'spreadsheets', 'presentations',
  'markdown', 'archives', 'emails', 'scripts', 'executables', 'other',
];

export function getMimeCategory(mime: string): MimeCategory {
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.oasis.opendocument.text'
  ) return 'documents';
  if (
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.oasis.opendocument.spreadsheet'
  ) return 'spreadsheets';
  if (
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mime === 'application/vnd.oasis.opendocument.presentation'
  ) return 'presentations';
  if (mime === 'text/markdown') return 'markdown';
  if (
    mime === 'application/zip' ||
    mime === 'application/x-tar' ||
    mime === 'application/gzip' ||
    mime === 'application/x-gzip'
  ) return 'archives';
  if (mime === 'message/rfc822') return 'emails';
  if (mime === 'application/x-java-keystore' || mime === 'application/x-pkcs12') return 'executables';
  if (mime === 'application/x-msdownload' || mime === 'application/octet-stream') return 'executables';
  if (mime === 'text/plain') return 'scripts';
  if (mime === 'text/csv' || mime === 'application/json' || mime === 'application/xml' || mime === 'text/xml') return 'other';
  if (mime === 'text/html') return 'other';
  return 'other';
}

export function groupAttachments<T extends { mime_type: string }>(
  attachments: T[],
): Map<MimeCategory, T[]> {
  const map = new Map<MimeCategory, T[]>();
  for (const att of attachments) {
    const cat = getMimeCategory(att.mime_type);
    const list = map.get(cat) ?? [];
    list.push(att);
    map.set(cat, list);
  }
  return map;
}
