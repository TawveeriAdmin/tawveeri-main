// Duplicate AI entry point retired (ADR-122). The free-form LLM chat is consolidated into the
// single "وفّر" assistant — the deterministic, evidence-citing advisor (constitution: engines
// decide, LLMs only phrase). One AI identity, one destination.
import { redirect } from 'next/navigation';

export default async function LegacyAssistantRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/advisor`);
}
