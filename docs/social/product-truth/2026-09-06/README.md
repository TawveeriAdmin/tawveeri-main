# Tawveeri Product Truth + Marketing/Social Operating Pack — 2026-09-06

**Purpose:** the definitive, production-grounded package for anyone (human or Grok) drafting Tawveeri social/marketing content, so no shopper journey is ever promised beyond what the live product actually does. Built per the founder's 2026-09-06 mission brief.

## Version / date / provenance
- **Pack version:** 1.0
- **Generated:** 2026-09-06
- **Data as of:** 2026-09-06 (live production, `tawveeri.com`)
- **Production identity:** System A, `vyceqrzttspyycdpojtn` (per CLAUDE.md — no separate build SHA was captured this pass; if one is needed, pull it from the current Railway deployment at time of use)
- **Method:** (1) an ADR-mining research pass over `docs/DECISIONS.md` ADR-290 through ADR-300 plus adjacent cited ADRs, `docs/CAPABILITY-CONTRACT.md`, and `docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md`; (2) a live production re-verification pass this session against `tawveeri.com` for the highest-risk claims (refrigerator lock/size, AC room-size, phone camera+budget, merchant exit-link, follow-up quick-actions).
- **Authoritative sources used:** current live production, current repository/ADRs. Prior chat memory was explicitly NOT treated as authoritative — every claim in this pack is either freshly live-verified or cited to a specific accepted ADR.

## Files in this pack

| File | What it is | Depth this pass |
|---|---|---|
| `SOCIAL_QUICK_START.md` | 5-minute onboarding — read this first | Full |
| `PRODUCT_TRUTH_SOCIAL_PACK_AR.md` | Primary operating version, Arabic | Full |
| `PRODUCT_TRUTH_SOCIAL_PACK_EN.md` | Faithful parallel, English | Full |
| `SOCIAL_CAPABILITY_CONTRACT.json` | Machine-readable capability contract for Grok | Full — extends `docs/CAPABILITY-CONTRACT.md` |
| `SOCIAL_CLAIMS_LEDGER.md` | The evidence backbone — every claim, cited | Full |
| `SOCIAL_ASSET_MANIFEST.md` | Shot list for social proof assets | Shot list only — no image files captured yet, see file for the capture checklist |
| `SOCIAL_CONTENT_7_DAY_BANK.md` | 7 evidence-backed content units | Full, one item on HOLD pending founder review |
| `SOCIAL_90_DAY_SAUDI_CALENDAR.md` | Sept-Dec 2026 Saudi demand calendar | Confidence-flagged; several entries marked UNKNOWN/unverified rather than guessed |
| `SOCIAL_CHANNEL_PLAYBOOK_X_TIKTOK.md` | X + TikTok operating playbook | Full |
| `SOCIAL_GOVERNANCE.md` | Public-content gates, prohibited/high-risk claims | Full |
| `PRODUCT_GAPS_FOR_SOCIAL.md` | Real defects found during this mission, not fixed (per mission §24) | Full — 2 new defects found live, 4 documented from existing ADRs |

Founder Product Review (mission §28, a separate deliverable) is at `docs/report/FOUNDER-PRODUCT-REVIEW-SEPTEMBER-2026.md`.

## What this pass did NOT do (explicit, per CLAUDE.md's task-ledger rule)
- Did not live-test: TV, laptop, tablet, washer, or Home Mission journeys. Their capability status in this pack is UNKNOWN/not-this-pass, not GREEN.
- Did not re-verify: smartphone battery-priority, performance-priority, or free-form pain-point search (existing YELLOW status carried forward, not upgraded).
- Did not capture distributable screenshot/video assets (`SOCIAL_ASSET_MANIFEST.md` is a shot list, not a delivered asset set) — the visible test account's cart/notification state made this pass's screenshots unsuitable for direct publication.
- Did not root-cause GAP-1 (follow-up quick-actions) or GAP-2 (search-box reproducibility) — found and recorded, not fixed, per mission §24.
- Did not modify `docs/CAPABILITY-CONTRACT.md` or `docs/DECISIONS.md` — those are ADR-owned documents; this pack's findings are offered as inputs to a future ADR (recommended: ADR-301), not applied unilaterally.

## Update process (owner / consumer)
```
Product/engineering change (a new ADR)
  -> capability status reviewed against the new ADR
  -> SOCIAL_CAPABILITY_CONTRACT.json updated (new dated entry)
  -> pack version bumped
  -> Grok/operators consume the latest dated version only
```
- **Owner:** Tawveeri engineering (whoever authors the relevant ADR).
- **Consumer:** Grok / social operations, read-only.
- **Rule:** Grok may never independently promote a YELLOW/RED claim to GREEN — only a new dated ADR or a documented live re-verification (a new section appended to `SOCIAL_CLAIMS_LEDGER.md`) can do that.

## Freshness
Treat this pack as needing a spot-check after **2026-09-20** — check `SOCIAL_CAPABILITY_CONTRACT.json`'s per-claim `revalidate_after` dates before relying on any single claim past that window.
