import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth/server';
import { AdminMfaSetup } from '@/components/auth/admin-mfa-setup';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function MfaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const profile = await getUserProfile();
  if (!profile) redirect(`/${locale}/auth/login?redirect=/auth/mfa`);
  if (profile.role !== 'admin') redirect(`/${locale}/unauthorized`);
  return <AdminMfaSetup locale={locale} />;
}
