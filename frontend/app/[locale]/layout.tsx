import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Toaster } from 'react-hot-toast';
import AuthProvider from '@/components/common/AuthProvider';
import Navbar from '@/components/common/Navbar';

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="container mx-auto px-4 py-8 max-w-5xl">
            {children}
          </main>
        </div>
        <Toaster position="top-right" />
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
