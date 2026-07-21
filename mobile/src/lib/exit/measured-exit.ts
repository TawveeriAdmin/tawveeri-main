// E11 — measured merchant exits. Every exit should flow through the platform's
// /go/{offerId} redirect so it produces an outbound_clicks row (attribution +
// affiliate injection). When an offerId (a TPS normalized-observation UUID) is
// available, we route through /go?source=mobile; otherwise we fall back to the
// raw URL (unattributed) — that fallback shrinks as the platform contracts
// return canonical offers with offerIds to the mobile client.
import { Linking } from 'react-native';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://tawveeri.com').replace(/\/$/, '');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ExitTarget {
  /** TPS normalized-observation id (UUID). When present the exit is measured via /go. */
  offerId?: string | null;
  /** Raw merchant URL — fallback when no offerId is available. */
  url?: string | null;
  /** Attribution channel; kept short/lowercased by /go. */
  source?: string;
}

/** True if this target will be attributed (has a usable offerId). */
export function isMeasurable(t: ExitTarget): boolean {
  return !!t.offerId && UUID_RE.test(t.offerId);
}

/** Build the measured /go URL, or null when no offerId is available. */
export function measuredExitUrl(t: ExitTarget): string | null {
  if (!isMeasurable(t)) return null;
  const source = t.source && /^[a-z_]{1,32}$/.test(t.source) ? t.source : 'mobile';
  return `${API_BASE}/go/${t.offerId}?source=${source}`;
}

/** Open a merchant exit: measured via /go when possible, else the raw URL. */
export async function openMeasuredExit(t: ExitTarget): Promise<void> {
  const measured = measuredExitUrl(t);
  const target = measured ?? (t.url || '');
  if (!target) return;
  try {
    await Linking.openURL(target);
  } catch {
    // last-resort fallback to the raw url if the measured redirect failed to open
    if (measured && t.url) await Linking.openURL(t.url).catch(() => undefined);
  }
}
