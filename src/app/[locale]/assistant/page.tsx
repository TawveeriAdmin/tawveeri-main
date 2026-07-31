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
  // P2-8: `/advisor` is itself a redirect now, so pointing here would cost every legacy
  // link two hops. One entry point means one destination — send them straight to it.
  redirect(`/${locale}/search`);
}
