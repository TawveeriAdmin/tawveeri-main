'use client';

// PRIVACY POLICY — rewritten 2026-08-07 under the public-trust/IA closeout mission.
//
// Fixes the same `t('legal.privacy')` broken-key defect as terms-client.tsx (no `legal`
// namespace exists), and replaces boilerplate ("we may collect...", generic cookie language)
// with a map of what Tawveeri's actual code collects, verified against the codebase during
// this mission rather than assumed:
//   - Auth: email/phone/OTP via Supabase Auth + Authentica (SMS OTP) — src/lib/auth/*
//   - `login_sessions`: device_fingerprint + user_agent + ip_address, written only at login,
//     for new-device alerting (src/app/api/auth/check-device/route.ts)
//   - `usage_events`: anonymous, PII-free funnel analytics keyed to a random browser-local
//     session id, not a user id (src/lib/analytics/track.ts) — no Google Analytics/Meta
//     Pixel/any third-party ad tracker exists in this codebase (verified by grep)
//   - Account data users add themselves: wishlists, price alerts, saved searches,
//     notifications, reviews
//   - Processors: Supabase (database/auth hosting), SendGrid (email), Authentica (SMS OTP,
//     Saudi provider), Sentry (error monitoring) — Supabase and SendGrid are non-KSA
//     infrastructure, hence the cross-border section (PDPL Art. 29 territory; see this
//     mission's research report for sourcing)
//   - Cookies/local storage: theme, locale, anonymous session id, compare-list, auth session
//     token — no advertising cookies
//
// No SCC/BCR mechanism is claimed for Supabase/SendGrid because none has been verified with
// those vendors — asserting one we haven't confirmed would itself be a misrepresentation.
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDate } from '@/lib/formatting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function PrivacyClient() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const lastUpdated = formatDate('2026-08-07', locale);

  const contactLink = (
    <Link href={`/${locale}/contact`} className="text-[var(--brand-green)] underline">
      {isRTL ? 'صفحة التواصل' : 'our contact page'}
    </Link>
  );

  return (
    <div>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-headline-lg">
              {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </CardTitle>
            <p className="mt-2 text-sm text-on-surface-variant">
              {isRTL ? `آخر تحديث: ${lastUpdated}` : `Last updated: ${lastUpdated}`}
            </p>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <div className="space-y-6 text-on-surface-variant">
              {isRTL ? (
                <>
                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">١. مقدمة</h2>
                    <p>
                      يمكنك تصفح توفيري والبحث والمقارنة دون إنشاء حساب أو تقديم أي بيانات شخصية. هذه السياسة تشرح
                      البيانات التي نجمعها فعليًا فقط — لا أكثر — عندما تستخدم ميزات تتطلب ذلك، ولماذا، وكيف نحميها.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٢. البيانات التي نجمعها</h2>
                    <div className="space-y-3">
                      <p>
                        <strong>عند إنشاء حساب:</strong> بريدك الإلكتروني أو رقم جوالك (حسب طريقة التسجيل)، واسمك إن
                        أدخلته. نستخدم رمز تحقق (OTP) لتأكيد رقم الجوال عبر مزوّد رسائل نصية سعودي.
                      </p>
                      <p>
                        <strong>عند تسجيل الدخول:</strong> نسجّل بصمة جهازك ونوع المتصفح وعنوان IP لمرة واحدة عند كل
                        دخول، فقط لتنبيهك إذا سُجِّل دخول من جهاز جديد على حسابك (حماية من الاختراق).
                      </p>
                      <p>
                        <strong>ما تضيفه بنفسك:</strong> قوائم المفضلة، تنبيهات الأسعار، عمليات البحث المحفوظة،
                        والتقييمات إن كتبت أيًا منها.
                      </p>
                      <p>
                        <strong>بيانات استخدام مجهولة:</strong> نسجّل أحداثًا مثل البحث وعرض منتج ومغادرة الموقع نحو
                        متجر، مرتبطة برقم جلسة عشوائي مخزّن في متصفحك — وليس بهويتك. لا نستخدم أدوات تتبّع إعلاني من
                        أي جهة خارجية (لا Google Analytics ولا Meta Pixel ولا ما شابه).
                      </p>
                      <p>
                        <strong>ملفات تعريف الارتباط والتخزين المحلي:</strong> نستخدمها لحفظ تفضيلاتك (اللغة، المظهر
                        الليلي/النهاري)، قائمة المقارنة، ورمز جلسة الدخول إن كان لديك حساب. لا نستخدم ملفات تعريف
                        ارتباط إعلانية.
                      </p>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٣. كيف نستخدم بياناتك</h2>
                    <ul className="list-inside list-disc space-y-1 ms-4">
                      <li>تشغيل الحساب والميزات التي طلبتها (تنبيهات الأسعار، المفضلة، البحث المحفوظ)</li>
                      <li>إرسال إشعارات طلبتها (تنبيه انخفاض سعر، توفر منتج، تنبيهات أمان الحساب)</li>
                      <li>حماية حسابك من الدخول غير المصرح به</li>
                      <li>قياس أداء الموقع بشكل مجهول لتحسين تجربة المستخدم</li>
                    </ul>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٤. مع من نشارك بياناتك</h2>
                    <p>
                      لا نبيع بياناتك الشخصية لأي جهة. نستخدم مزوّدي خدمة لتشغيل المنصة فقط: استضافة قاعدة البيانات
                      والمصادقة (Supabase)، إرسال البريد الإلكتروني (SendGrid)، إرسال رسائل التحقق النصية (مزوّد سعودي
                      لخدمات OTP)، ومراقبة الأعطال التقنية (Sentry). هؤلاء معالجون لبياناتك نيابة عنا، لا يستخدمونها
                      لأغراضهم الخاصة.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٥. معالجة البيانات خارج المملكة</h2>
                    <p>
                      بعض مزوّدي الخدمة أعلاه (استضافة قاعدة البيانات وإرسال البريد الإلكتروني) يعالجون البيانات على
                      بنية تحتية خارج المملكة العربية السعودية، بما يستدعي ضوابط نقل البيانات عبر الحدود بموجب نظام
                      حماية البيانات الشخصية. نتعامل مع مزوّدين معتمدين ملتزمين بمعايير حماية بيانات معترف بها، ونحرص
                      على أن يقتصر الوصول إلى بياناتك على ما تتطلبه الخدمة نفسها.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٦. مدة الاحتفاظ بالبيانات</h2>
                    <p>
                      نحتفظ ببيانات حسابك طالما كان الحساب نشطًا. عند حذف حسابك، نحذف بياناتك الشخصية أو نُخفي هويتها
                      خلال مدة معقولة، ما لم يلزمنا نظام بالاحتفاظ بها لمدة أطول.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٧. الأمان</h2>
                    <p>
                      نتخذ إجراءات أمنية معقولة لحماية بياناتك من الوصول أو الاستخدام أو الإفصاح غير المصرح به، بما في
                      ذلك التشفير أثناء النقل وضوابط وصول صارمة على قاعدة البيانات.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٨. حقوقك</h2>
                    <p>بموجب نظام حماية البيانات الشخصية، يحق لك:</p>
                    <ul className="list-inside list-disc space-y-1 ms-4">
                      <li>معرفة البيانات التي نحتفظ بها عنك والاطلاع عليها</li>
                      <li>تصحيح أي بيانات غير دقيقة</li>
                      <li>طلب حذف بياناتك</li>
                      <li>سحب موافقتك على استخدام بياناتك في أي وقت</li>
                    </ul>
                    <p className="mt-2">لممارسة أي من هذه الحقوق، تواصل معنا عبر {contactLink}. نرد خلال مدة معقولة لا تتجاوز 30 يومًا.</p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٩. التعديلات</h2>
                    <p>
                      قد نُحدّث هذه السياسة من وقت لآخر. سنُحدّث تاريخ &quot;آخر تحديث&quot; أعلى هذه الصفحة عند أي تغيير
                      جوهري.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">١٠. التواصل</h2>
                    <p>لأي سؤال حول هذه السياسة أو بياناتك، تواصل معنا عبر {contactLink}.</p>
                  </section>
                </>
              ) : (
                <>
                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">1. Introduction</h2>
                    <p>
                      You can browse, search, and compare on Tawveeri without creating an account or providing any
                      personal data. This policy explains only the data we actually collect — nothing more — when you
                      use features that require it, why, and how we protect it.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">2. Data we collect</h2>
                    <div className="space-y-3">
                      <p>
                        <strong>When you create an account:</strong> your email or phone number (depending on how you
                        sign up), and your name if you provide one. We use a one-time code (OTP) to confirm your phone
                        number via a Saudi SMS provider.
                      </p>
                      <p>
                        <strong>When you sign in:</strong> we record your device fingerprint, browser type, and IP
                        address once per login, solely to alert you if a new device signs in to your account (account
                        security).
                      </p>
                      <p>
                        <strong>What you add yourself:</strong> wishlists, price alerts, saved searches, and any
                        reviews you write.
                      </p>
                      <p>
                        <strong>Anonymous usage data:</strong> we record events like searching, viewing a product, and
                        leaving Tawveeri for a retailer, tied to a random session id stored in your browser — not your
                        identity. We do not use any third-party advertising tracker (no Google Analytics, no Meta
                        Pixel, or similar).
                      </p>
                      <p>
                        <strong>Cookies and local storage:</strong> used to remember your preferences (language,
                        light/dark theme), your compare list, and your login session token if you have an account. We
                        do not use advertising cookies.
                      </p>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">3. How we use your data</h2>
                    <ul className="list-inside list-disc space-y-1 ms-4">
                      <li>Running your account and the features you asked for (price alerts, wishlist, saved searches)</li>
                      <li>Sending notifications you requested (price-drop alerts, back-in-stock, account-security alerts)</li>
                      <li>Protecting your account from unauthorized access</li>
                      <li>Measuring site performance anonymously to improve the experience</li>
                    </ul>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">4. Who we share your data with</h2>
                    <p>
                      We do not sell your personal data to anyone. We use service providers only to run the platform:
                      database and authentication hosting (Supabase), email delivery (SendGrid), SMS verification
                      codes (a Saudi OTP provider), and technical error monitoring (Sentry). These providers process
                      your data on our behalf and do not use it for their own purposes.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">5. Processing outside Saudi Arabia</h2>
                    <p>
                      Some of the providers above (database hosting and email delivery) process data on
                      infrastructure located outside Saudi Arabia, which engages the cross-border transfer rules
                      under the Personal Data Protection Law. We work with reputable providers held to recognized
                      data-protection standards, and access to your data is limited to what the service itself
                      requires.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">6. How long we keep your data</h2>
                    <p>
                      We keep your account data for as long as your account is active. When you delete your account,
                      we delete or de-identify your personal data within a reasonable period, unless the law requires
                      us to retain it longer.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">7. Security</h2>
                    <p>
                      We take reasonable security measures to protect your data from unauthorized access, use, or
                      disclosure, including encryption in transit and strict database access controls.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">8. Your rights</h2>
                    <p>Under the Personal Data Protection Law, you have the right to:</p>
                    <ul className="list-inside list-disc space-y-1 ms-4">
                      <li>Know and access the data we hold about you</li>
                      <li>Correct any inaccurate data</li>
                      <li>Request deletion of your data</li>
                      <li>Withdraw your consent to our use of your data at any time</li>
                    </ul>
                    <p className="mt-2">
                      To exercise any of these rights, reach us via {contactLink}. We respond within a reasonable
                      period, not exceeding 30 days.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">9. Changes to this policy</h2>
                    <p>
                      We may update this policy from time to time. We will update the &quot;Last updated&quot; date at
                      the top of this page whenever a material change is made.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">10. Contact</h2>
                    <p>For any question about this policy or your data, reach us via {contactLink}.</p>
                  </section>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
