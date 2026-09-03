// src/lib/analytics/interaction.ts
// ADR-286 (second correction pass, 2026-09-03) — the ONE place a decision-grade first-party
// interaction is recorded. Call this from an onClick handler, synchronously, BEFORE
// navigating — it never awaits the network call (fail-open navigation; see CRITICAL below).
//
// WHY THIS EXISTS, PRECISELY. A render-time token (go-token.ts) proves a link came from our
// own server — but a crawler that merely fetches the SAME rendered response gets an
// identically valid token, so a token alone cannot prove a click happened (adversarial-test
// finding, same day). `interaction_id` fixes this structurally rather than cryptographically:
// it is generated HERE, in the browser, at the moment this function runs — it is NEVER
// embedded in server-rendered HTML or API JSON, so there is nothing for a page-fetcher to
// discover and replay. Only code that actually executes this exact click-handling JS path can
// ever produce a valid one.
//
// CRITICAL — fail-open navigation, fail-closed analytics. This function must be called and
// must return synchronously so the caller can attach the id to its destination URL and
// navigate immediately after. It NEVER blocks on the network request succeeding: if the
// beacon/fetch fails or is dropped, the customer still reaches the merchant — Tawveeri simply
// undercounts that one interaction rather than fabricating one it never confirmed.
import { sessionId } from './track';

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* noop */ }
  return 'i-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface RecordInteractionInput {
  /** The raw /go path segment this interaction targets (offer UUID or `ps_<uuid>`), if any. */
  goId?: string | null;
  canonicalId?: string | null;
  surface: string;
}

/**
 * Records that a real onClick just fired. Returns the freshly-minted interaction_id — append
 * it to the destination `/go` URL as `?iid=<id>` (see appendInteractionId) so the two records
 * can be exact-joined later. Never throws, never awaits — safe to call unconditionally from
 * any click handler regardless of network conditions.
 */
export function recordFirstPartyInteraction(input: RecordInteractionInput): string {
  const interactionId = uuid();
  try {
    const payload = JSON.stringify({
      interaction_id: interactionId,
      go_id: input.goId ?? null,
      canonical_id: input.canonicalId ?? null,
      session_id: sessionId(),
      surface: input.surface,
    });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // sendBeacon: purpose-built for "fire this during/just-before unload, browser owns
      // best-effort delivery" — exactly this call's shape. Returns immediately either way.
      const ok = navigator.sendBeacon('/api/interactions', new Blob([payload], { type: 'text/plain' }));
      if (ok) return interactionId;
    }
    // Fallback (sendBeacon unavailable or its queue was full): fetch with keepalive so the
    // request can still complete after the page starts navigating away. Deliberately NOT
    // awaited — the caller must not wait on this before navigating.
    if (typeof fetch !== 'undefined') {
      fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: payload,
        keepalive: true,
      }).catch(() => { /* best-effort */ });
    }
  } catch {
    /* measurement must never break the click it's attached to */
  }
  return interactionId;
}

/** Attach `?iid=<id>` (and, when present, preserve any query string already on the href) to a
 *  `/go/...` destination URL — the exact-join key `/go` stores verbatim on the ledger row. */
export function appendInteractionId(href: string, interactionId: string): string {
  try {
    const [path, query = ''] = href.split('?');
    const params = new URLSearchParams(query);
    params.set('iid', interactionId);
    return `${path}?${params.toString()}`;
  } catch {
    return href;
  }
}
