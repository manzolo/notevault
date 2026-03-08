import type { Metadata } from 'next';
import '@/styles/globals.css';
import { themeScript } from '@/lib/themeScript';

export const metadata: Metadata = {
  title: 'NoteVault',
  description: 'Self-hosted multi-user knowledge base with encrypted secrets management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
