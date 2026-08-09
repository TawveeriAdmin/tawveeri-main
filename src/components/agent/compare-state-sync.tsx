'use client';

import { useEffect } from 'react';
import { readDecisionState, createDecisionState, markSelectedProduct, saveDecisionState } from '@/lib/agent/decision-state';

/**
 * CompareStateSync — Section 44 closure (2026-08-09, ADR-234).
 *
 * The compare page is a Server Component with no chat/free-text surface — there is no
 * question to classify here. What CAN be closed honestly: the compare page had ZERO
 * connection to `DecisionState` (grep-verified before this change), so a shopper who
 * compared a product and then went back to ask Waffar a follow-up lost that they had just
 * been looking at it. This records `selected_product` on mount — best-effort, same
 * same-tab/no-throw discipline as every other `decision-state.ts` write. A tiny invisible
 * component, not a new UI: the compare page renders exactly as it did before, unchanged.
 */
export function CompareStateSync({ canonicalId }: { canonicalId: string }) {
  useEffect(() => {
    try {
      const existing = readDecisionState() ?? createDecisionState();
      saveDecisionState(markSelectedProduct(existing, canonicalId));
    } catch {
      /* best-effort only, same as journey-context.ts's discipline */
    }
  }, [canonicalId]);
  return null;
}
