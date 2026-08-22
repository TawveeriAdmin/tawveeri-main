// src/lib/agent/return-to-decision.ts
// Decision Card v1 (§D) — has this shopper already seen THIS smart pick this session?
// Deliberately independent of DecisionState (kept untouched per this feature's own ADR — see
// decision-state.ts): a dedicated, same-tab sessionStorage marker, cleared with the tab exactly
// like journey-context.ts/decision-state.ts already are. Best-effort; never throws.
const KEY_PREFIX = 'tawveeri:decision_card_seen:';

export function hasSeenDecisionCard(canonicalId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(KEY_PREFIX + canonicalId) === '1';
  } catch {
    return false;
  }
}

export function markDecisionCardSeen(canonicalId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY_PREFIX + canonicalId, '1');
  } catch {
    /* best-effort only */
  }
}
