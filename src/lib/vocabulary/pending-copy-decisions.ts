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
  // EMPTY, AND THAT IS THE MECHANISM WORKING — not a register nobody used.
  //
  // Three entries stood here on 2026-08-01: «أفضل سعر حالياً» / "Current best price",
  // «السعر الحالي» / "Current Price", and the validation message beside them. F7·1 surfaced
  // them, the founder decided the wording under F1 the same day, `LAUNCH_VOCABULARY.md` §10 was
  // amended FIRST and the copy followed. The approved replacement is «آخر سعر رصدناه» /
  // "Last Observed Price"; validation messages carry the same framing as a sentence rather than
  // the label's exact words.
  //
  // A FOURTH string was found while applying it — `dashboard.json:currentPrice` = "Current" /
  // «الحالي», rendered as "Current: <price>" on the dashboard alert card. It had never been
  // flagged because `price-currency-claim` requires a price word within 40 characters and this
  // label carries none: the price sits in a sibling component. Found by grepping the bundles for
  // the CLAIM rather than trusting the scanner to have found every instance of it — the same
  // lesson every instrument error in this repo has taught.
  //
  // The register is empty because the debt was paid, not because it was cleared. The stale-entry
  // check in `vocabulary-scan` and in `vocabulary.test.ts` keeps any future entry honest.
] as const;


/** `<file>:<key>` set, for the scanner. */
export const PENDING_KEYS: ReadonlySet<string> = new Set(PENDING_COPY_DECISIONS.map((p) => p.where));
