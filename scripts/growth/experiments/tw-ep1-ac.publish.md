# tw-ep1-ac — Publish Packages (PREPARED, NOT PUBLISHED)

**Master creative:** `public/growth/tw-ep1-ac.mp4` — «مسلسل توفيري · الحلقة ١ — المكيف»,
9:16, 1080×1920, 30fps, ~25.8s, H.264+AAC. ONE master, TWO distribution variants —
the channel split is `utm_source` (tiktok vs x); `utm_content=tw-ep1-ac` stays the
content lineage on both. Publication is a manual founder act; approval ≠ publication.

Governance: caption/post texts audited against LAUNCH_VOCABULARY — no real-time/cadence
claims, no coverage claims, no retailer counts, no savings promises. The only prices a
viewer sees are the live production UI inside the video.

---

## TikTok package — @tawveeri

- **File:** `public/growth/tw-ep1-ac.mp4` (upload as-is; TikTok re-encodes).
- **Caption (Saudi, doesn't retell the video):**
  «أبو فهد كان بيلف المحلات… أم فهد حسمتها وهي على الكنب 😌
  اكتب طلبك بكلامك العادي وقارن قبل ما تشتري ✅
  الرابط في البايو 👆»
- **CTA:** قارن قبل ما تشتري — tawveeri.com (رابط البايو).
- **Hashtags (قليلة ومدروسة):** #توفيري #مكيفات #السعودية
- **Cover/thumbnail:** إطار الرسالة الأولى («المكيف صار يسوّي صوت أكثر ما يبرّد 😤»)
  مع عنوان الغلاف «قبل تشتري مكيف…» — الأقوى إيقافًا للتمرير في التصفح.
- **Tracking URL (bio + first comment):**
  `https://tawveeri.com/ar?utm_source=tiktok&utm_medium=organic_social&utm_campaign=cdv_wave1&utm_content=tw-ep1-ac`
- **Campaign/Content:** `cdv_wave1` / `tw-ep1-ac`.
- **Publish notes:** أضف موسيقى رائجة من مكتبة تيك توك التجارية داخل المحرر إن رغبت
  (الأسلم حقوقيًا)؛ خلّ صوت النقرات الأصلي منخفضًا أو أطفئه حسب الموسيقى.

## X package — @Tawveeri

- **File:** نفس الملف `tw-ep1-ac.mp4` (متوافق مع X: ≤2:20, H.264/AAC, 9:16 مدعوم).
- **Post text (منشور واحد، بلا thread):**
  «المكيف خرب والزوج ما عنده وقت يلف المحلات.
  الحل كان أسهل مما توقع — الحلقة الأولى من مسلسل توفيري 👇
  قارن قبل ما تشتري: tawveeri.com/ar?utm_source=x&utm_medium=organic_social&utm_campaign=cdv_wave1&utm_content=tw-ep1-ac»
- **CTA:** قارن قبل ما تشتري.
- **Tracking URL:**
  `https://tawveeri.com/ar?utm_source=x&utm_medium=organic_social&utm_campaign=cdv_wave1&utm_content=tw-ep1-ac`
- **Campaign/Content:** `cdv_wave1` / `tw-ep1-ac` (القناة تُفرز بـ`utm_source=x`).
- **Alt text (accessibility):** «محادثة بين زوجين عن شراء مكيف جديد تنتهي برحلة بحث
  حقيقية على توفيري تعرض نتائج وأسعار مكيفات من متاجر سعودية.»
- **Publish notes:** فيديو مرفوع أصليًا (native upload) لا رابط يوتيوب/خارجي؛ الرابط داخل
  نص المنشور — X يسمح بالرابط مع الفيديو في نفس المنشور.

---

**Post-publish measurement (ADR-244 pipeline, nothing new built):**
sessions landing with these UTMs are stamped (`tw_sid`/`tw_campaign`) → searches/journeys
tracked in `usage_events` → retailer exits CONFIRMED in the `outbound_clicks` ledger with
the campaign object → per-channel split visible by `utm_source` in `/admin/command-center`
(campaign attribution) and `/admin/growth`. Success = qualified sessions and retailer
exits per channel, not views.
