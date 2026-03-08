import { redirect } from 'next/navigation';

export default function LocaleIndexPage({ params: { locale } }: { params: { locale: string } }) {
  redirect(`/${locale}/dashboard`);
}
