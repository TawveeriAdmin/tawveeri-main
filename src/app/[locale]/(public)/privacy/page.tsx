'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function PrivacyPage() {
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
 {t('legal.privacy')}
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
 1. مقدمة
 </h2>
 <p>
 نحن في توفيري ملتزمون بحماية خصوصيتك. توضح هذه السياسة كيفية جمع واستخدام
 وحماية معلوماتك الشخصية عند استخدام موقعنا.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 2. المعلومات التي نجمعها
 </h2>
 <div className="space-y-2">
 <p>
 <strong>المعلومات الشخصية:</strong> قد نجمع معلومات مثل اسمك وعنوان بريدك
 الإلكتروني ورقم هاتفك عند إنشاء حساب.
 </p>
 <p>
 <strong>معلومات الاستخدام:</strong> نجمع معلومات عن كيفية استخدامك لموقعنا،
 بما في ذلك صفحاتك التي تزورها والمنتجات التي تبحث عنها.
 </p>
 <p>
 <strong>ملفات تعريف الارتباط:</strong> نستخدم ملفات تعريف الارتباط لتحسين
 تجربتك وتحليل استخدام الموقع.
 </p>
 </div>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 3. كيفية استخدام المعلومات
 </h2>
 <p>نستخدم المعلومات التي نجمعها لـ:</p>
 <ul className="list-disc list-inside space-y-1 ml-4">
 <li>توفير وتحسين خدماتنا</li>
 <li>إرسال إشعارات حول تغييرات الأسعار والعروض</li>
 <li>تحليل استخدام الموقع لتحسين تجربة المستخدم</li>
 <li>منع الاحتيال وضمان الأمان</li>
 </ul>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 4. مشاركة المعلومات
 </h2>
 <p>
 لا نبيع معلوماتك الشخصية لأطراف ثالثة. قد نشارك معلومات مجمعة أو مجهولة
 الهوية لأغراض إحصائية أو تحليلية.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 5. الأمان
 </h2>
 <p>
 نتخذ إجراءات أمنية معقولة لحماية معلوماتك الشخصية من الوصول غير المصرح به
 أو الاستخدام أو الكشف.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 6. حقوقك
 </h2>
 <p>
 لديك الحق في الوصول إلى معلوماتك الشخصية وتصحيحها أو حذفها في أي وقت. يمكنك
 أيضًا طلب تقرير عن البيانات التي نحتفظ بها.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 7. التعديلات
 </h2>
 <p>
 قد نحدّث سياسة الخصوصية هذه من وقت لآخر. سنقوم بإشعارك بأي تغييرات من خلال
 تحديث تاريخ "آخر تحديث" في هذه الصفحة.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 8. الاتصال بنا
 </h2>
 <p>
 إذا كان لديك أي أسئلة حول سياسة الخصوصية هذه، يرجى الاتصال بنا من خلال
 صفحة الاتصال.
 </p>
 </section>
 </>
 ) : (
 <>
 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 1. Introduction
 </h2>
 <p>
 At Tawveeri, we are committed to protecting your privacy. This policy explains
 how we collect, use, and protect your personal information when using our
 site.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 2. Information We Collect
 </h2>
 <div className="space-y-2">
 <p>
 <strong>Personal Information:</strong> We may collect information such as
 your name, email address, and phone number when you create an account.
 </p>
 <p>
 <strong>Usage Information:</strong> We collect information about how you use
 our site, including pages you visit and products you search for.
 </p>
 <p>
 <strong>Cookies:</strong> We use cookies to improve your experience and
 analyze site usage.
 </p>
 </div>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 3. How We Use Information
 </h2>
 <p>We use the information we collect to:</p>
 <ul className="list-disc list-inside space-y-1 ml-4">
 <li>Provide and improve our services</li>
 <li>Send notifications about price changes and deals</li>
 <li>Analyze site usage to improve user experience</li>
 <li>Prevent fraud and ensure security</li>
 </ul>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 4. Information Sharing
 </h2>
 <p>
 We do not sell your personal information to third parties. We may share
 aggregated or anonymized information for statistical or analytical purposes.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 5. Security
 </h2>
 <p>
 We take reasonable security measures to protect your personal information from
 unauthorized access, use, or disclosure.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 6. Your Rights
 </h2>
 <p>
 You have the right to access, correct, or delete your personal information at
 any time. You can also request a report of the data we hold about you.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 7. Modifications
 </h2>
 <p>
 We may update this Privacy Policy from time to time. We will notify you of any
 changes by updating the "Last updated" date on this page.
 </p>
 </section>

 <Separator />

 <section>
 <h2 className="text-2xl font-semibold mb-3 text-on-surface">
 8. Contact Us
 </h2>
 <p>
 If you have any questions about this Privacy Policy, please contact us through
 our contact page.
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

