# SOCIAL_CHANNEL_PLAYBOOK_X_TIKTOK.md

Two channels only, per current operating reality (ADR-297). No assumption of TikTok Business Verification or any paid tooling not already confirmed live.

---

## X

**Role:** authority + Intent Desk (proactive, high-quality replies to real shopper questions) + evidence-forward content.

**Intent Desk workflow (mandatory, no exceptions):**
```
SHOW the original post verbatim
  -> SHOW the exact proposed reply
  -> RECOMMEND (why reply, why now)
  -> FOUNDER APPROVAL (exact text)
  -> PUBLISH the exact approved reply
```

**Reply quality bar:** every reply that makes a capability claim must cite (internally, for the founder's approval step — not necessarily in the public reply) a row from `SOCIAL_CLAIMS_LEDGER.md`. A reply that would require a RED capability must decline honestly rather than imply support (see Content 7's "what we can't do yet" pattern for tone).

**Content mix on X:** trust/evidence posts (fake-discount catches, neutrality statements) + real reply threads + occasional "how to ask Tawveeri" education. Avoid pure promotional posts with no evidence attached.

**Link/no-link rule:** link when the post demonstrates or resolves a real, working journey (search results, an exit-link proof). Do not link when the claim is aspirational, a RED capability, or a general trust statement with no specific query behind it.

**Measurement:** track post-level engagement as platform-native (X's own numbers); track click-throughs to tawveeri.com via UTM as deterministic; never claim a downstream purchase without checking `affiliate_reports`/`affiliate_conversions` (currently 0 confirmed rows — see `SOCIAL_CLAIMS_LEDGER.md` C6).

---

## TikTok

**Role:** discovery/education via short, spoken-keyword, on-screen-text search demos.

**Current operating constraint (do not assume otherwise):** fully manual — one founder-reviewed video published at a time. No scheduled bulk uploads, no auto-posting, no assumption of TikTok Business Verification.

**Format that fits the evidence:** screen-recorded real search (query → chip recognition → honest disclosure or reasoned pick), 15-30 seconds, spoken query read aloud + on-screen captions in Arabic, ending on the specific proof moment (the disclosure line, the capacity match, the fake-discount catch) rather than a generic CTA.

**What NOT to depict:** the non-functional follow-up quick-action buttons (GAP-1); the unrelated "Hot Deals" grid below search results (GAP-3); any signed-in account/cart state from a personal or shared test account.

**Profile/grid:** keep a consistent visual pattern (same caption style, same crop style) so repeat viewers recognize the format; do not batch-publish multiple similar videos same-day without founder review of each.

**Comments:** read and triage manually; a comment claiming a bug or wrong price should be escalated per `SOCIAL_GOVERNANCE.md` §8, never auto-replied with a promise.

**Manual publishing constraint:** current workflow implies iPhone-based manual publishing per prior operating notes — confirm current device/workflow with the founder before assuming automation is available; do not build or request TikTok API automation without an explicit ask.

---

## Future channels (not yet built, do not assume)

Google/other channels are out of scope for this playbook version — no evidence exists of an active Tawveeri presence or strategy there as of 2026-09-06. Add a new section here only once a channel is actually operating, following the same evidence-first structure.
