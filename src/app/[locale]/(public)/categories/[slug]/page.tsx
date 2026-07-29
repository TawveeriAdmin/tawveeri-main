// /categories/<slug> — a category landing URL that resolves to that category's results.
// Previously any such URL 404'd (nothing in the app linked here, but crawlers and people
// guess it, and an external reviewer hit it). An unknown slug still 404s honestly rather
// than dumping the shopper on an unrelated page.
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CATS, findCategory } from '../categories';

export function generateStaticParams() {
  return CATS.flatMap((c) => [{ slug: c.slug }, ...c.aliases.map((a) => ({ slug: a }))]);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const cat = findCategory(slug);
  if (!cat) return { title: 'توفيري' };
  const isAr = locale !== 'en';
  const name = isAr ? cat.ar : cat.en;
  return {
    title: isAr ? `${name} — قارن الأسعار | توفيري` : `${name} — compare prices | Tawveeri`,
    description: isAr
      ? `قارن أسعار ${name} عبر متاجر السعودية.`
      : `Compare ${name} prices across Saudi stores.`,
  };
}

export default async function CategorySlugPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const cat = findCategory(slug);
  if (!cat) notFound();
  redirect(`/${locale}/search?q=${encodeURIComponent(cat.q)}`);
}
