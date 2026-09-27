import { track } from './track';
import { homeSource, type HomeSource } from '@/lib/agent/home-mission-discovery';

export function currentHomeSource(): HomeSource {
  return typeof window === 'undefined' ? 'direct' : homeSource(new URLSearchParams(window.location.search).get('source'));
}
/** Closed vocabulary only: no description, room/person name or capability URL. */
export function trackHome(step: string, source: HomeSource = currentHomeSource(), mode: 'personal' | 'example' | 'shared' = 'personal', facts: Record<string, string | number | boolean | null> = {}) {
  track('home_mission', { source, meta: { ...facts, step, mode } });
}
