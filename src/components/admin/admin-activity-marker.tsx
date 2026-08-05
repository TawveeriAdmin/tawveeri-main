'use client';

import { useEffect } from 'react';

// ADR-216 — Founder Commercial Intelligence. Sets the `tw_admin` cookie so future
// usage_events/outbound_clicks rows from this browser are excluded from REAL metrics
// (checked server-side in /api/events and /go/[offerId]/route.ts). Mounted ONLY inside
// src/app/[locale]/admin/layout.tsx, which is itself gated by requireAdmin() — by the time
// this component renders, the server has already confirmed the user is an admin, so no
// client-side role check is duplicated or trusted here. Only affects future events;
// historical rows are never touched.
export function AdminActivityMarker() {
  useEffect(() => {
    try {
      document.cookie = 'tw_admin=1; path=/; max-age=2592000; samesite=lax';
    } catch { /* best-effort */ }
  }, []);
  return null;
}
