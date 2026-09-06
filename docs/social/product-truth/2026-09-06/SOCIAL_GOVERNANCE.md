# SOCIAL_GOVERNANCE.md

Public-content gates for anyone (human or Grok) drafting Tawveeri social/marketing content. This governs process, not creativity — the content itself lives in `SOCIAL_CONTENT_7_DAY_BANK.md`, the channel playbook, and the pack.

## 1. The public-action gate (non-negotiable)

```
SHOW the exact artifact (post text / video script / reply / image)
     -> RECOMMEND (why this, why now, expected effect)
     -> WAIT
     -> FOUNDER EXACT APPROVAL (the founder approves the artifact as shown, not a paraphrase of it)
     -> PUBLISH the exact approved artifact, unchanged
```

No step may be skipped or compressed. Approval of one artifact does not carry forward to a similar future artifact — each publish action is approved individually. This mirrors the existing X-reply workflow in `docs/CAPABILITY-CONTRACT.md`'s governing ADRs and the standing engineering rule that commercial/public actions require explicit confirmation.

## 2. Prohibited claims (never publish, regardless of framing or founder mood)

- "Cheapest in Saudi Arabia" / "أرخص سعر في السعودية" — never provably true across an unbounded market.
- "All stores" / "جميع المتاجر" — only 8 of 24 registry stores actively serve (`SOCIAL_CLAIMS_LEDGER.md` C3).
- "All prices" / "live prices" as an unqualified claim — freshness is typically 1-2h, not proven real-time (B8).
- "Complete coverage" of any category — AC has zero Amazon offers (B9); comparable products are 1,384 of 7,112 published (C1/C2).
- "Official [Merchant] partner" — true for none as of this pack; Noon explicitly blocked on unresolved legal consent (B13).
- Any capability marked **RED** in `SOCIAL_CAPABILITY_CONTRACT.json` — including: unnamed A-vs-B comparison, buy-now-vs-wait guidance, automatic catalog discovery, the follow-up quick-action buttons (GAP-1), a live Grok/AI integration (B10).
- Implying confirmed revenue, commission, or "helped shoppers save $X total" as a company-wide figure — zero confirmed affiliate revenue exists (C6). Per-product "وفّر X ريال" figures ARE real and safe to cite individually.

## 3. High-risk claims (require the Claims Ledger citation inline in the approval request, not just in this pack)

- Any specific "X% cheaper" or "Tawveeri saved you X SAR" figure — must cite the exact live product/date it came from.
- Any claim that a merchant is "usually cheaper" — TV-category evidence says the opposite of what most people assume (B14).
- Any claim of merchant partnership, even implied by logo placement — check clause-8.3 status (B13) before using any merchant logo in a way that could read as endorsement.
- Any capability claim for smartphone battery/performance/pain-point search (GAP-6) until re-verified live.

## 4. Price claims

- A price shown in content must be the actual last-observed price at the time of drafting, with the observation date. Prices "may change" — never present a screenshot price as a standing promise.
- Never state a percentage discount without the anti-fake-discount check (A9) having passed for that specific product at that specific time.

## 5. Merchant claims

- Merchant neutrality is a Constitutional invariant (ranking is never commercial). Content must never imply one merchant is favored.
- A merchant's logo/name may appear as "available at X" (organic, factual) but never as "in partnership with X" absent written consent on file.

## 6. Partnership claims

- No partnership claim of any kind (retailer, payment, logistics) may be published without the founder confirming, in the approval step, that a signed agreement exists. Silence is not consent.

## 7. Product capability claims

- Every capability claim in published content must trace to a row in `SOCIAL_CLAIMS_LEDGER.md` or `SOCIAL_CAPABILITY_CONTRACT.json` marked GREEN, with `last_verified` inside its `revalidate_after` window at time of publishing.
- A claim whose only evidence is "founder-cited, not independently re-verified" (YELLOW rows) must be re-verified live before use — not published on the strength of the citation alone.

## 8. Complaint handling

- A public complaint about a wrong price, broken link, or missing product is answered honestly: acknowledge, do not defend, do not promise a specific fix timeline unless engineering has confirmed one. Route to founder if the complaint reveals a new defect not already in `PRODUCT_GAPS_FOR_SOCIAL.md`.

## 9. Security/privacy

- Never expose: admin/debug UI, other users' data, internal engineering IDs (session IDs, internal ADR numbers in public copy is fine since ADRs are non-sensitive engineering process, but internal table/column names, internal Slack-style shorthand, or anything from `docs/DECISIONS.md` marked read-only-internal must not appear verbatim in public content).
- Screenshots must be captured from a test/demo account context where reasonably possible, and reviewed for any real user data before publishing (see `SOCIAL_ASSET_MANIFEST.md`).

## 10. Founder escalation

Escalate to the founder (do not decide unilaterally) whenever:
- A claim's evidence status is genuinely ambiguous between YELLOW and GREEN.
- A competitor is named in a comparison post.
- A complaint thread alleges a legal, safety, or PDPL/privacy issue.
- Any request to promise something not yet in this pack's evidence base.

## 11. Freshness / change management

```
Product/engineering change (a new ADR)
   -> capability status reviewed against the new ADR
   -> SOCIAL_CAPABILITY_CONTRACT.json updated (new dated entry, never silently overwritten)
   -> pack version bumped, dated
   -> Grok/operators consume the latest dated version only
```

- **Owner of Product Truth updates:** Tawveeri engineering (Claude Code sessions authoring ADRs), per the existing rule in `docs/CAPABILITY-CONTRACT.md` §"How a new capability gets added or changed here."
- **Consumer:** Grok / social operations — read-only.
- **Grok may never independently promote a RED or YELLOW claim to GREEN.** Only a new dated ADR, or a documented live re-verification added as a new section in `SOCIAL_CLAIMS_LEDGER.md`, can do that.
- This pack (dated 2026-09-06) should be treated as stale after **2026-09-20** for any claim whose `revalidate_after` date has passed — check `SOCIAL_CAPABILITY_CONTRACT.json` per-claim before relying on an old pack wholesale.
