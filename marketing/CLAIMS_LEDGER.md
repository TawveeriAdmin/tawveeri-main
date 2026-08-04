# CLAIMS LEDGER — Controlled Demand Validation, Wave 1
**Schema authority:** docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §12.
**Rule (unchanged):** no claim without owner + evidence + date. Expired claims are dead — a
new number never inherits the old sentence if the measured population's definition changed.
Internal-allowed ≠ publish-allowed. Public corrections link to the original piece, never
silently delete it.

**Approval state note:** every claim below is `PENDING_FOUNDER_APPROVAL`. Per the founder's
own hard line ("no unmeasured public claim authorised" / "major public announcement needs
founder sign-off") and the fact that this whole Launch Pack is explicitly built as
**unpublished**, nothing here goes live until reviewed and its state is changed to `APPROVED`
by the founder, claim by claim.

**Founder-review checkpoint closed 2026-08-04 (HANDOVER checkpoint #47, ADR-208).** All ten
corrections from the founder's review passes are verified applied. **Every claim below
remains `PENDING_FOUNDER_APPROVAL` — no claim has been marked `APPROVED`.** The decision on
each is deferred until the founder is ready to begin public execution; this is a stopping
point, not an approval.

---

```yaml
- claim_id: cdv-w1-claim-01
  public_wording_ar: "آخر سعر رصدناه لتلفزيون سامسونج UA55U8000HUXSA: 1,649 ريال (أمازون)."
  public_wording_en: "Last observed price for the Samsung UA55U8000HUXSA TV: 1,649 SAR (Amazon)."
  claim_class: measured
  source_of_truth: marketing/SOCIAL_FACT_PACK_2026-08-04.md, Candidate 5
  evidence_query: npx tsx scripts/tps-analysis/build-social-fact-pack.ts
  measured_at: "2026-08-04T09:28:20Z"
  expires_at: "2026-08-06T09:28:20Z"   # 48h, per Fact Pack rule — re-run before use past this
  product_or_scope: canonical_id 5fd63409-f0e2-40e9-8388-9576b864f732
  allowed_platforms: [tiktok, x, instagram]
  approval_state: PENDING_FOUNDER_APPROVAL
  published_content_ids: [cdv-w1-video-01, cdv-w1-x-06]
  rollback_or_correction: if re-measurement shows a different lowest price before publish, this
    claim is retired (not edited) and a new claim_id is issued for the new figure.

- claim_id: cdv-w1-claim-02
  public_wording_ar: "آخر سعر رصدناه لساعة Apple Watch 11 46mm: 1,579 ريال (أمازون)."
  public_wording_en: "Last observed price for Apple Watch 11 46mm: 1,579 SAR (Amazon)."
  claim_class: measured
  source_of_truth: marketing/SOCIAL_FACT_PACK_2026-08-04.md, Candidate 4
  evidence_query: npx tsx scripts/tps-analysis/build-social-fact-pack.ts
  measured_at: "2026-08-04T09:28:20Z"
  expires_at: "2026-08-06T09:28:20Z"
  product_or_scope: canonical_id db8b083e-1e52-4f8b-9c2f-ce9eef530fd4
  allowed_platforms: [tiktok, x, instagram]
  approval_state: PENDING_FOUNDER_APPROVAL
  published_content_ids: [cdv-w1-video-02, cdv-w1-x-07]
  rollback_or_correction: retire and reissue on re-measurement drift, never silently edit.

- claim_id: cdv-w1-claim-03
  public_wording_ar: "آخر سعر رصدناه لقلاية فيليبس الهوائية 9 لتر: 779 ريال."
  public_wording_en: "Last observed price for the Philips 9L air fryer: 779 SAR."
  claim_class: measured
  source_of_truth: marketing/SOCIAL_FACT_PACK_2026-08-04.md, Candidate 12
  evidence_query: npx tsx scripts/tps-analysis/build-social-fact-pack.ts
  measured_at: "2026-08-04T09:28:20Z"
  expires_at: "2026-08-06T09:28:20Z"
  product_or_scope: canonical_id d5fdff4a-f23e-4c33-a750-cb9859a947af
  allowed_platforms: [tiktok, instagram]
  approval_state: PENDING_FOUNDER_APPROVAL
  published_content_ids: [cdv-w1-video-03, cdv-w1-x-03, cdv-w1-x-08]
  rollback_or_correction: retire and reissue on re-measurement drift.

- claim_id: cdv-w1-claim-04
  public_wording_ar: "آخر سعر رصدناه لخلاط فيليبس 450 واط: 119 ريال."
  public_wording_en: "Last observed price for the Philips 450W blender: 119 SAR."
  claim_class: measured
  source_of_truth: marketing/SOCIAL_FACT_PACK_2026-08-04.md, Candidate 7
  evidence_query: npx tsx scripts/tps-analysis/build-social-fact-pack.ts
  measured_at: "2026-08-04T09:28:20Z"
  expires_at: "2026-08-06T09:28:20Z"
  product_or_scope: canonical_id d5a3e16c-797e-4912-a86e-31baa5f9d426
  allowed_platforms: [tiktok, x, instagram]
  approval_state: PENDING_FOUNDER_APPROVAL
  published_content_ids: [cdv-w1-video-04, cdv-w1-x-09]
  rollback_or_correction: retire and reissue on re-measurement drift.

- claim_id: cdv-w1-claim-05
  public_wording_ar: "من بين العروض التي فحصناها، 60% أشارت إلى سعر \"كان\" لم نرصده نحن من قبل."
  public_wording_en: "Among the offers we examined, 60% referenced a \"was\" price we never
    observed ourselves."
  claim_class: evergreen
  source_of_truth: LAUNCH_VOCABULARY.md §CAN SAY (L58/67), evidence line L165-171
  evidence_query: "curl https://tawveeri.com/api/v1/tps/discount-integrity"
  measured_at: "2026-08-04T09:38:13Z — LIVE this session. The cached figure this ledger
    inherited from LAUNCH_MARKETING_PLAYBOOK's own digest (70%, itself a successor to
    87.7%→72%→71%) was ALREADY STALE by the time this pack was assembled — re-curling just
    now returned inflated_reference_share_pct=60 (15,010 checkable listings, 9,003
    inflated_reference / 60%). This is exactly the drift the 'never carry forward' rule
    exists to catch. Use 60%, not 70%, and re-curl again same-day at actual publish —
    do not trust even this number past today."
  expires_at: "same day as publish only (re-curl every time, no exceptions)"
  product_or_scope: "all examined offers, not a specific product — the 'among the offers we
    examined' qualifier from vocabulary MUST stay attached, never dropped"
  allowed_platforms: [x, tiktok]
  approval_state: PENDING_FOUNDER_APPROVAL
  published_content_ids: [cdv-w1-video-05, cdv-w1-x-04]
  rollback_or_correction: if the re-curled figure differs from 70% at publish time, use the
    fresh number and cite the new date — never the cached 70%.
  correction_2026-08-04: "cdv-w1-carousel-01 was removed from this list — its actual slide
    copy (see marketing/LAUNCH_PACK_wave1.md) uses claim-08, not this claim; the earlier
    listing here and in CONTENT_LEDGER.csv was a bookkeeping error, now fixed in both files,
    not deferred."

- claim_id: cdv-w1-claim-06
  public_wording_ar: "نقول متى ما كنا لا نعرف."
  public_wording_en: "When we don't know, we say so."
  claim_class: evergreen
  source_of_truth: LAUNCH_VOCABULARY.md §CAN SAY (L60/70)
  evidence_query: "n/a — a product-honesty principle, not a measured figure"
  measured_at: "n/a"
  expires_at: "does not expire — standing principle, re-check against vocabulary before each use"
  product_or_scope: general
  allowed_platforms: [tiktok, x, instagram]
  approval_state: PENDING_FOUNDER_APPROVAL
  published_content_ids: [cdv-w1-video-05, cdv-w1-x-05, cdv-w1-carousel-01, cdv-w1-carousel-02]
  rollback_or_correction: n/a — this is the closing/honesty line per LAUNCH_MARKETING_PLAYBOOK
    §3 (never the opening line, always the close).

- claim_id: cdv-w1-claim-08
  public_wording_ar: "ما نحسب التوفير من رقم مشطوب. نحسبه من أسعار رصدناها بأنفسنا — وقد يكون
    رقمنا أقل من رقم المتجر."
  public_wording_en: "We don't compute savings from a struck-through number. We compute it
    from prices we observed ourselves — often lower than the retailer's own figure."
  claim_class: evergreen
  source_of_truth: LAUNCH_VOCABULARY.md §CAN SAY (L57/66)
  evidence_query: "n/a — a methodology statement; the specific number in any given post must
    still come from a fresh Fact Pack run"
  measured_at: "n/a"
  expires_at: "does not expire — standing methodology line"
  product_or_scope: general
  allowed_platforms: [x, instagram]
  approval_state: PENDING_FOUNDER_APPROVAL
  published_content_ids: [cdv-w1-x-02, cdv-w1-carousel-01]
  rollback_or_correction: n/a

- claim_id: cdv-w1-claim-07
  public_wording_ar: "قارن أسعار الأجهزة الإلكترونية في متاجر متعددة بالسعودية."
  public_wording_en: "Compare electronics prices across Saudi retailers."
  claim_class: evergreen
  source_of_truth: LAUNCH_VOCABULARY.md §9 (L220-252) — replaces the retired "8 retailers" phrasing
  evidence_query: "n/a — an uncounted, non-numeric positioning line by design"
  measured_at: "n/a"
  expires_at: "does not expire — but any addition of a number to this line requires a new
    vocabulary amendment first (F1)"
  product_or_scope: general/homepage/bio
  allowed_platforms: [tiktok, x, instagram, snapchat, youtube]
  approval_state: PENDING_FOUNDER_APPROVAL
  published_content_ids: [cdv-w1-x-01, cdv-w1-carousel-01, cdv-w1-carousel-02]
  rollback_or_correction: n/a
```
