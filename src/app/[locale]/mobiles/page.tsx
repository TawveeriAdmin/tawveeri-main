// Standalone /mobiles catalog retired as a duplicate entry point (ADR-122). Phone discovery now
// flows through the single search surface, keeping one path per job.
import { redirect } from 'next/navigation';

export default async function LegacyMobilesRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/search?category=smartphone`);
}
