# SOCIAL_CONTENT_7_DAY_BANK.md

Seven content units, each tied to a real, cited journey. Not one-per-day by mandate — quality gated. Status: READY (evidence complete, needs only asset capture + approval) / NEEDS QA (claim needs a live re-check first) / HOLD (do not publish).

---

### Content 1 — "We don't guess" (refrigerator lock)
- **Channel:** X + TikTok · **Intent:** trust/differentiation
- **Query:** أبي ثلاجة صغيرة وقفلها مهم
- **Hook (AR):** "سألنا توفيري عن ثلاجة صغيرة... وقفلها مهم لنا. شوفوا وش قال." / **(EN):** "We asked for a small fridge with a lock. Here's what it actually said."
- **Script:** show the search → show the size match → show the honest lock-uncertainty disclosure → caption: "we'd rather tell you the truth than guess."
- **On-screen text:** "ما نخمّن — نفصح" / "We don't guess — we disclose"
- **Live UI proof:** AST-01
- **Claim status:** GREEN (A1, A2)
- **CTA:** "جرّب وصف احتياجك بكلامك" / "Describe what you need, in your own words"
- **Destination:** tawveeri.com search
- **Measurement hypothesis:** higher save/share rate than a generic feature post, since it's a real screen not a claim
- **Status:** READY (pending asset capture, AST-01)

### Content 2 — "Right size AC for your room"
- **Channel:** TikTok · **Intent:** utility/education
- **Query:** مكيف لغرفة 25 متر بميزانية 2500
- **Hook:** "غرفتك 25 متر؟ قول لتوفيري بس كذا وبيطلع لك المكيف المناسب"
- **Script:** type the query on-screen → show room-size chip → show BTU-matched result with reason
- **On-screen text:** capacity match callout
- **Live UI proof:** AST-02
- **Claim status:** GREEN (A4) — but disclose Amazon AC gap if asked in comments
- **CTA:** "جرب بمساحة غرفتك"
- **Destination:** tawveeri.com search
- **Measurement hypothesis:** AC is the highest-demand category — expect strong reach if hook lands in first 2 seconds
- **Status:** READY (pending asset capture, AST-02)

### Content 3 — "Camera matters most? Say so."
- **Channel:** X + TikTok · **Intent:** product education
- **Query:** جوال كاميرا ممتازة بميزانية 2000
- **Hook:** "الكاميرا أهم شي عندك؟ قول كذا بالضبط"
- **Script:** query → chips → top pick with camera reasoning
- **On-screen text:** "ليش هذا الترشيح؟" → show the one-line reason
- **Live UI proof:** AST-03 (crop out follow-up buttons per GAP-1)
- **Claim status:** GREEN (A6)
- **CTA:** "جرّب بأولويتك أنت"
- **Destination:** tawveeri.com search
- **Measurement hypothesis:** strong for a camera-focused audience segment
- **Status:** READY (pending asset capture, AST-03)

### Content 4 — "Real discount or not?"
- **Channel:** X · **Intent:** trust
- **Basis:** the fake-discount catch seen across all 3 journeys
- **Hook:** "شفت خصم يقول 'كان بـ5699 صار بـ1710'؟ توفيري يتأكد قبل لا يصدّق"
- **Script:** show one product card with the "لم نرصده يومًا بهذا السعر" line
- **On-screen text:** the line itself, verbatim
- **Live UI proof:** AST-05
- **Claim status:** GREEN (A9)
- **CTA:** none needed — pure trust post
- **Destination:** n/a (informational)
- **Measurement hypothesis:** high save-rate trust content
- **Status:** READY (pending asset capture, AST-05)

### Content 5 — "Where does the link actually take you?"
- **Channel:** TikTok · **Intent:** trust/transparency
- **Basis:** live exit-link test (A11)
- **Hook:** "توفيري ما يبيع — يوديك عند المتجر مباشرة. شوف بنفسك"
- **Script:** click through from a result → land on the real merchant page
- **On-screen text:** "متجر حقيقي، سعر حقيقي"
- **Live UI proof:** AST-04 (must crop signed-in account/cart per manifest)
- **Claim status:** GREEN (A11)
- **CTA:** "قارن قبل ما تشتري"
- **Destination:** tawveeri.com
- **Measurement hypothesis:** builds trust for first-time users unsure "how this works"
- **Status:** NEEDS QA — must re-capture with a clean demo account per `SOCIAL_ASSET_MANIFEST.md`, current test-tab shot exposes account state

### Content 6 — "Ranking's never for sale"
- **Channel:** X · **Intent:** brand trust
- **Basis:** neutrality line on every results page
- **Hook:** "ترتيب النتائج عندنا مو للبيع"
- **Script:** static image of the footer line + one clean results screenshot
- **On-screen text:** the line verbatim
- **Live UI proof:** AST-06
- **Claim status:** GREEN
- **CTA:** none
- **Destination:** n/a
- **Measurement hypothesis:** evergreen, low-effort, repostable
- **Status:** READY (pending asset capture, AST-06)

### Content 7 — "What Tawveeri can't do yet (and won't fake)"
- **Channel:** X (thread) · **Intent:** trust/differentiation, higher risk — founder review recommended before publish
- **Basis:** the honest zero-match fallback + RED capability list
- **Hook:** "توفيري ما يسوّي كل شي بعد — وبنقولكم بالضبط وش لا"
- **Script:** 3-tweet thread: (1) what we do well with a real example, (2) what we honestly can't do yet (no auto-discovery, no buy-now-or-wait verdict), (3) why we'd rather say that than fake it
- **On-screen text:** n/a (text thread)
- **Live UI proof:** AST-07
- **Claim status:** mixed by design (GREEN framing of RED facts) — every RED item cited from `SOCIAL_CAPABILITY_CONTRACT.json`
- **CTA:** "اسألنا أي سؤال عن جهازك الجاي"
- **Destination:** n/a
- **Measurement hypothesis:** differentiator content performs well with power users; founder should review tone before publish given it names real limitations publicly
- **Status:** HOLD — founder review required before drafting exact tweet text (governance §10 escalation: publicly naming limitations is a judgment call, not a routine post)
