'use client';

// TERMS OF USE — rewritten 2026-08-07 under the public-trust/IA closeout mission.
//
// Two defects fixed:
//   1. `t('legal.terms')` rendered as the literal string "legal.terms" — there is no `legal`
//      namespace anywhere in messages/{ar,en}. Replaced with hardcoded bilingual copy, same
//      pattern as About/How-it-works/Contact/FAQ (this route is a rare one-off legal page,
//      not a namespace worth wiring into the 20-file i18n system for two pages).
//   2. Generic "Terms of Service" boilerplate that never stated Tawveeri is not the seller of
//      record, never distinguished a Tawveeri problem from a retailer problem, and referenced
//      a "contact page" that was itself a 404. Rewritten around what Tawveeri actually is
//      (docs/DECISIONS.md + research in this mission's report): a non-transacting comparison
//      platform monetized via retailer affiliate links, currently the Amazon Associates
//      programme.
//
// No fabricated CR/VAT/registered-address — none is on file in this repository, and the
// Constitution's "never fabricate" rule extends to legal identity fields. Flagged as a
// founder action item in the mission's final report, not invented here.
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDate } from '@/lib/formatting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function TermsClient() {
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
              {isRTL ? 'شروط استخدام توفيري' : 'Tawveeri Terms of Use'}
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
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">١. ما هو توفيري</h2>
                    <p>
                      توفيري (&quot;نحن&quot;، &quot;المنصة&quot;) منصة سعودية بواجهة عربية وإنجليزية لمقارنة أسعار
                      الإلكترونيات والأجهزة المنزلية بين متاجر سعودية. توفيري{' '}
                      <strong>لا يبيع أي منتج، ولا يشحنه، ولا يخزّنه، وليس طرفًا في أي عملية بيع.</strong> نحن نعرض
                      أسعارًا رصدناها من مواقع المتاجر ونتيح لك مقارنتها؛ الشراء نفسه يتم بينك وبين المتجر الذي
                      تختاره.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٢. المعاملات مع المتاجر</h2>
                    <p>
                      عندما تختار متجرًا، ننقلك إلى صفحة المنتج في موقع ذلك المتجر. أي عقد بيع يُبرم بينك وبين
                      المتجر مباشرة، ويخضع لشروط ذلك المتجر وسياساته الخاصة بالدفع والشحن والاستبدال والضمان. توفيري
                      ليس طرفًا في هذا العقد ولا مسؤولًا عن تنفيذه.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٣. دقة الأسعار والمعلومات</h2>
                    <p>
                      نبذل جهدًا حقيقيًا لرصد أسعار دقيقة وعرضها مع تاريخ الرصد. لكن الأسعار في المتاجر تتغيّر باستمرار
                      وقد تختلف عمّا رصدناه بحلول وقت زيارتك لصفحة المتجر. نعرض السعر الذي رصدناه، لا سعرًا لحظيًا
                      مضمونًا — تحقق دائمًا من السعر النهائي والتوفر في صفحة المتجر قبل إتمام الشراء. لا نضمن دقة أو
                      اكتمال كل معلومة نعرضها، ونصحح أي خطأ نُبلَّغ به فور التحقق منه.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٤. الروابط والعلامات التجارية لأطراف ثالثة</h2>
                    <p>
                      أسماء المتاجر وشعاراتها المعروضة على توفيري ملك لأصحابها، وتُستخدم للإشارة إلى مصدر السعر أو
                      المنتج فقط. ظهور متجر على توفيري لا يعني بحد ذاته شراكة أو رعاية أو تأييدًا من ذلك المتجر لتوفيري
                      أو العكس، إلا إذا ذُكر ذلك صراحة. الروابط الخارجية تنقلك خارج توفيري، ولسنا مسؤولين عن محتوى أو
                      سياسات تلك المواقع.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٥. حساب المستخدم</h2>
                    <p>
                      بعض الميزات (مثل حفظ عمليات البحث وتنبيهات انخفاض الأسعار) تتطلب حسابًا. أنت مسؤول عن الحفاظ على
                      سرية بيانات دخولك، وعن أي نشاط يتم من خلال حسابك.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٦. الاستخدام المقبول</h2>
                    <p>
                      يُمنع استخدام توفيري لأي غرض غير قانوني، أو محاولة استخراج بياناته بشكل آلي جماعي (scraping) دون
                      إذن، أو التدخل في عملها الطبيعي، أو انتحال صفة توفيري أو أي متجر تعرضه.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٧. الملكية الفكرية</h2>
                    <p>
                      تصميم توفيري ونصوصه وشعاره (باستثناء أسماء وشعارات المتاجر والمنتجات المملوكة لأصحابها) ملك
                      لتوفيري ومحمي بموجب أنظمة الملكية الفكرية.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٨. التصحيح والإبلاغ</h2>
                    <p>
                      إذا لاحظت سعرًا خاطئًا أو رابطًا معطلاً أو مطابقة منتج غير صحيحة، أخبرنا عبر {contactLink} — نراجع
                      كل بلاغ لأن دقة ما نعرضه هي أساس الثقة في توفيري.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">٩. حدود المسؤولية</h2>
                    <p>
                      يُقدَّم توفيري &quot;كما هو&quot;. لا نتحمل مسؤولية الأضرار الناتجة عن معاملة تمت مع متجر خارجي، أو عن
                      تغيّر سعر بعد رصدنا له. لا شيء في هذه الشروط يُسقط أي حق إلزامي يكفله لك نظام حماية المستهلك في
                      المملكة العربية السعودية.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">١٠. القانون الحاكم</h2>
                    <p>تخضع هذه الشروط لأنظمة المملكة العربية السعودية وتُفسَّر وفقًا لها.</p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">١١. التعديلات</h2>
                    <p>
                      قد نُحدّث هذه الشروط من وقت لآخر. سنُحدّث تاريخ &quot;آخر تحديث&quot; أعلى هذه الصفحة عند أي تغيير
                      جوهري.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">١٢. التواصل</h2>
                    <p>لأي سؤال حول هذه الشروط، تواصل معنا عبر {contactLink}.</p>
                  </section>
                </>
              ) : (
                <>
                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">1. What Tawveeri is</h2>
                    <p>
                      Tawveeri (&quot;we&quot;, &quot;the platform&quot;) is a bilingual Saudi platform for comparing
                      electronics and home-appliance prices across Saudi retailers. Tawveeri{' '}
                      <strong>does not sell, ship, or stock any product, and is not a party to any sale.</strong> We
                      show prices we observed on retailers&apos; own sites and let you compare them; the purchase
                      itself happens between you and the store you choose.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">2. Transactions with retailers</h2>
                    <p>
                      When you choose a store, we take you to that product&apos;s page on the retailer&apos;s own
                      site. Any sale contract is formed directly between you and the retailer, and is governed by that
                      retailer&apos;s own terms for payment, shipping, returns, and warranty. Tawveeri is not a party
                      to that contract and is not responsible for its fulfillment.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">3. Accuracy of prices and information</h2>
                    <p>
                      We make a genuine effort to observe accurate prices and show the date we observed them. Retailer
                      prices change continuously and may differ from what we observed by the time you reach the
                      retailer&apos;s page. We show the price we observed, not a guaranteed live price — always confirm
                      the final price and availability on the retailer&apos;s page before completing a purchase. We do
                      not guarantee that every piece of information we display is accurate or complete, and we correct
                      any error we can verify.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">4. Third-party links and trademarks</h2>
                    <p>
                      Store names and logos shown on Tawveeri belong to their respective owners and are used only to
                      identify the source of a price or product. A store appearing on Tawveeri does not by itself mean
                      a partnership, sponsorship, or endorsement between that store and Tawveeri in either direction,
                      unless explicitly stated. External links take you off Tawveeri; we are not responsible for the
                      content or policies of those sites.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">5. User accounts</h2>
                    <p>
                      Some features (such as saved searches and price-drop alerts) require an account. You are
                      responsible for keeping your login credentials confidential and for any activity under your
                      account.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">6. Acceptable use</h2>
                    <p>
                      You may not use Tawveeri for any unlawful purpose, attempt bulk automated scraping of the
                      platform without permission, interfere with its normal operation, or impersonate Tawveeri or any
                      store it shows.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">7. Intellectual property</h2>
                    <p>
                      Tawveeri&apos;s design, text, and logo (excluding store and product names/logos owned by their
                      respective owners) belong to Tawveeri and are protected under applicable intellectual-property
                      law.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">8. Correction and reporting</h2>
                    <p>
                      If you notice a wrong price, a broken link, or an incorrect product match, tell us via{' '}
                      {contactLink} — we review every report, because the accuracy of what we show is the whole basis
                      of trusting Tawveeri.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">9. Limitation of liability</h2>
                    <p>
                      Tawveeri is provided &quot;as is&quot;. We are not liable for damages arising from a transaction
                      with an external retailer, or from a price change after we observed it. Nothing in these Terms
                      removes any mandatory right granted to you under Saudi consumer-protection law.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">10. Governing law</h2>
                    <p>These Terms are governed by, and construed in accordance with, the laws of Saudi Arabia.</p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">11. Changes to these Terms</h2>
                    <p>
                      We may update these Terms from time to time. We will update the &quot;Last updated&quot; date at
                      the top of this page whenever a material change is made.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="mb-3 text-2xl font-semibold text-on-surface">12. Contact</h2>
                    <p>For any question about these Terms, reach us via {contactLink}.</p>
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
