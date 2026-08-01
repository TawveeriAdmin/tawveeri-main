// F7·1 — PENDING COPY DECISIONS. Not vocabulary. A debt register.
//
// WHAT THIS IS, AND WHAT IT IS NOT. Writing the vocabulary down surfaced live customer copy
// that violates it. Fixing that copy is a WORDING decision under Appendix F1 — the vocabulary
// is amended first, with evidence, and the founder decides — and it is outside F7·1, whose
// deliverable is the vocabulary as data. So each finding is recorded here: visible, versioned,
// owned, and printed on every scan run.
//
// THIS IS NOT A SUPPRESSION LIST, and it is built so it cannot become one:
//   • every entry states WHAT is unresolved and WHO must decide it — never just a hash;
//   • the scanner prints all of them, loudly, on every run including a passing one;
//   • a STALE entry FAILS the gate. If the copy is reworded and the finding disappears, the
//     acknowledgement must be deleted. An entry that no longer matches anything is how a
//     suppression list quietly becomes permanent.
//
// Mechanically-derived classes are deliberately NOT listed here — they need no human assertion:
//   • LATENT copy (zero references in `src/`) is classified by the scanner from the repository,
//     matching §5's own reasoning that unrendered strings are not a launch blocker;
//   • OPERATOR surfaces (`store.json`, `admin.json`) are outside the customer vocabulary's
//     scope by definition — a merchant editing their own price legitimately sees "Current Price".

export interface PendingCopyDecision {
  /** `<bundle file>:<dotted key>` — matches both locales' copies of the same key. */
  where: string;
  /** The rule it trips. */
  ruleId: string;
  /** The strings as shipped, so the decision can be made without re-deriving the evidence. */
  shipped: { ar: string; en: string };
  /** Why it is unresolved rather than fixed — the reasoning, not an excuse. */
  reason: string;
  /** Who must decide. */
  owner: string;
  since: string;
}

export const PENDING_COPY_DECISIONS: readonly PendingCopyDecision[] = [
  {
    where: 'product.json:priceAlertCurrentPrice',
    ruleId: 'price-currency-claim',
    shipped: { ar: 'أفضل سعر حالياً', en: 'Current best price' },
    reason:
      'Live in the price-alert dialog. §3 forbids "current" as a price-freshness word, and this ' +
      'label asserts the price is current when it is OBSERVED, with an age we display elsewhere. ' +
      'The replacement is not obvious — «أفضل سعر رصدناه» / "Best price we observed" is accurate ' +
      'but longer and changes a control a customer reads while setting a threshold. A wording ' +
      'change to live customer copy is an F1 decision, not an engineering one.',
    owner: 'founder (F1 — amend the vocabulary or the copy, with evidence)',
    since: '2026-08-01 · surfaced by F7·1',
  },
  {
    where: 'product.json:priceAlertInvalid',
    ruleId: 'price-currency-claim',
    shipped: {
      ar: 'يرجى إدخال سعر مستهدف صحيح أقل من السعر الحالي.',
      en: 'Please enter a valid target price below the current price.',
    },
    reason:
      'Same class, in a validation message. Arguably weaker — it refers to the number on screen ' +
      'rather than making a market claim — but the document draws no such line, and inventing ' +
      'one in code is exactly the drift this artefact exists to prevent.',
    owner: 'founder (F1)',
    since: '2026-08-01 · surfaced by F7·1',
  },
  {
    where: 'products.json:priceAlert.currentPrice',
    ruleId: 'price-currency-claim',
    shipped: { ar: 'السعر الحالي', en: 'Current Price' },
    reason:
      'Live in the price-alert card. A bare field label; the same wording decision as the two ' +
      'above and should be settled together rather than piecemeal.',
    owner: 'founder (F1)',
    since: '2026-08-01 · surfaced by F7·1',
  },
] as const;

/** `<file>:<key>` set, for the scanner. */
export const PENDING_KEYS: ReadonlySet<string> = new Set(PENDING_COPY_DECISIONS.map((p) => p.where));
