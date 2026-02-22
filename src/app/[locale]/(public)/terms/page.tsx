'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function TermsPage() {
 const params = useParams();
 const t = useTranslations();
 const locale = (params?.locale as string) || 'ar';
 const isRTL = locale === 'ar';
 const lastUpdated = new Date('2025-01-15').toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US');

 return (
 <div>
 <div className="container mx-auto px-4 py-8 max-w-4xl">
 <Card>
 <CardHeader>
 <CardTitle className="text-headline-lg">
 {t('legal.terms')}
 </CardTitle>
 <p className="text-sm text-on-surface-variant mt-2">
 {isRTL ? `آخر تحديث: ${lastUpdated}` : `Last updated: ${lastUpdated}`}
 </p>
 </CardHeader>
 <CardContent className="prose prose-gray max-w-none">
 <div className="space-y-6 text-on-surface-variant">
 {isRTL ? (
 <>
 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 1. القبول
 </h2>
 <p>
 بوصولك إلى واستخدامك لموقع توفيري، فإنك تقبل وتوافق على الالتزام بهذه الشروط
 والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، فيرجى عدم استخدام
 موقعنا.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 2. استخدام الخدمة
 </h2>
 <p>
 توفيري هي منصة لمقارنة الأسعار تتيح للمستخدمين البحث عن المنتجات ومقارنة
 الأسعار من مختلف المتاجر. نحن لا نبيع المنتجات مباشرة، بل نقدم معلومات
 لأغراض المقارنة فقط.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 3. دقة المعلومات
 </h2>
 <p>
 نسعى جاهدين لتوفير معلومات دقيقة ومحدثة. ومع ذلك، لا نضمن دقة أو اكتمال
 جميع المعلومات المعروضة. الأسعار والعروض قابلة للتغيير في أي وقت دون إشعار.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 4. مسؤولية المستخدم
 </h2>
 <p>
 أنت مسؤول عن استخدامك للموقع. لا يجوز لك استخدام الموقع لأي غرض غير قانوني
 أو غير مصرح به. يجب عليك الحفاظ على سرية معلومات حسابك.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 5. حقوق الملكية الفكرية
 </h2>
 <p>
 جميع المحتويات الموجودة على الموقع، بما في ذلك النصوص والصور والشعارات، هي
 ملك لتوفيري أو مقدمي المحتوى المعنيين ومحمية بموجب قوانين حقوق الملكية
 الفكرية.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 6. الروابط الخارجية
 </h2>
 <p>
 قد يحتوي موقعنا على روابط لمواقع خارجية. نحن لسنا مسؤولين عن محتوى أو سياسات
 الخصوصية لهذه المواقع الخارجية.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 7. التعديلات
 </h2>
 <p>
 نحتفظ بالحق في تعديل هذه الشروط والأحكام في أي وقت. سيتم إشعارك بأي تغييرات
 من خلال تحديث تاريخ "آخر تحديث" في أعلى هذه الصفحة.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 8. الاتصال بنا
 </h2>
 <p>
 إذا كان لديك أي أسئلة حول هذه الشروط والأحكام، يرجى الاتصال بنا من خلال
 صفحة الاتصال.
 </p>
 </section>
 </>
 ) : (
 <>
 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 1. Acceptance
 </h2>
 <p>
 By accessing and using Tawveeri, you accept and agree to be bound by these
 Terms of Service. If you do not agree to any part of these terms, please do
 not use our site.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 2. Use of Service
 </h2>
 <p>
 Tawveeri is a price comparison platform that allows users to search for
 products and compare prices from various stores. We do not sell products
 directly, but provide information for comparison purposes only.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 3. Information Accuracy
 </h2>
 <p>
 We strive to provide accurate and up-to-date information. However, we do not
 guarantee the accuracy or completeness of all information displayed. Prices
 and offers are subject to change at any time without notice.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 4. User Responsibility
 </h2>
 <p>
 You are responsible for your use of the site. You may not use the site for any
 unlawful or unauthorized purpose. You must maintain the confidentiality of
 your account information.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 5. Intellectual Property Rights
 </h2>
 <p>
 All content on the site, including text, images, and logos, is the property of
 Tawveeri or respective content providers and protected by intellectual property
 laws.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 6. External Links
 </h2>
 <p>
 Our site may contain links to external websites. We are not responsible for
 the content or privacy policies of these external websites.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 7. Modifications
 </h2>
 <p>
 We reserve the right to modify these Terms of Service at any time. You will
 be notified of any changes by updating the "Last updated" date at the top of
 this page.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 8. Contact Us
 </h2>
 <p>
 If you have any questions about these Terms of Service, please contact us
 through our contact page.
 </p>
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

