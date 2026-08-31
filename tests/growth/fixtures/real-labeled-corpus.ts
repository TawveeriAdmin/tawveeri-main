// Real, founder-labeled Demand Radar evidence this codebase has retained — the ONE canonical
// copy, shared by every backtest that needs it (tests/growth/policy-v2-backtest.test.ts,
// tests/growth/rank-redesign-backtest.test.ts). Extracted 2026-08-31 (ADR-280) from what was
// previously a private, duplicated copy inside policy-v2-backtest.test.ts alone — same texts,
// same verdicts, relocated only. Never edit a verdict here without re-verifying against the
// original founder review; this is evidence, not a tunable fixture.
export type LabeledCase = { text: string; category: string | null; founderVerdict: 'valuable' | 'not_valuable' };

// Radar 1's ENTIRE real, founder-reviewed production history (23/23) — verbatim texts and
// verdicts reconstructed from production in an earlier session's Part 2 work.
export const RADAR1_REAL: LabeledCase[] = [
  { text: '@mha_almaly أنا أبي ايفون سبع طعش', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'أحتاج مكيف يركض وراي وين ما اروح', category: 'air_conditioner', founderVerdict: 'not_valuable' },
  { text: 'ياحظكم مره ابغى ايباد من يوم كان عمري ١٠ لما بدت تنزل الايبادات الحلوة وانا ابي بالاخير اخواتي حصلو ايبادات الا انا 👌🏽', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: '@Emkan ودي جدا جدا جوالي هونر لكن أبغى جوال جديد #جوابك_يربحك', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@4TTTN @AzizbagBag يستاهل طيب انا مشجعله نصراويه ابي ايفون😃', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'والله مدري شفيني صايره منجد ابي جوال مو عشان البطارية لا لا انا ابي اكشخ بجوال جديد ولعلي ندمت اني ماطلبت من اهلي يجيبون', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@sahseh اكييييييد بشتري ايباد او لاب عشان الجامعه واذا مايكفي بشتري كل شي احتاجه عشان ابدا مشروع الكروشيه', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: 'انقمعت عشاني ابي جوال جديد 🩷 بعدين قلت انتو ما تحبوني افرج اصغر اخ بالبيت', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@yaser5066 ابي غسالة اكواب', category: 'washing_machine', founderVerdict: 'not_valuable' },
  { text: 'ابي ايباد جديد وربي ابكي ابي ولد جديد', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: '@barq ابي ايفون 👀⚡️⚡️⚡️', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@barq ابي ايباد مينيييي🥺', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: 'ابي سماعة ما تعور اذني ما تطيح مو سماعة راس شكلها حلو', category: 'audio', founderVerdict: 'not_valuable' },
  { text: 'ابي مكيف', category: 'air_conditioner', founderVerdict: 'not_valuable' },
  { text: 'محتاره بشتري لابتوب جديد الي كنت ابيه خلص والي موجود معالجه اقل منه بس ينفع عادي لي وفي نفس الوقت طرت بواحد اقوى', category: 'laptop', founderVerdict: 'not_valuable' },
  { text: '@ovdgo2 ابي جوال', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@ovdgo2 ابي ايباد🤩', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: '@__6j3 اي ابي هدايا ابي ايفون اخر اصدار ابي فلوس', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@Maya_t_59 يازين شاشتك ابغى شاشة زي كذا بكم شريتيها', category: 'tv', founderVerdict: 'not_valuable' },
  { text: 'أحتاج مكيف جري ٣٦٠٠٠ سبليت جداري هل موجود لديكم', category: 'air_conditioner', founderVerdict: 'valuable' },
  { text: '#فلة_وسيارات_هدايا_رسيس #رسيس_قول_وفعل #اليوم_الوطني ماشاء الله ربي يغنيكم انا ابي جوال فقط انسان قنوع 🥹', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'حرانة من الصبح ابغى مكيف 3 طن', category: 'air_conditioner', founderVerdict: 'not_valuable' },
  { text: 'بموت ابي   ايباد 😭😭😭😭!!!!', category: 'tablet', founderVerdict: 'not_valuable' },
];

// Shadow PRODUCT_RECOMMENDATION — all 25 real, founder-reviewed candidates (Checkpoint 5's 22 +
// the 2026-08-30 temporal-validation batch's 3).
export const SHADOW_PRODUCT_RECOMMENDATION: LabeledCase[] = [
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ قبل ما تشتري شوف المقارنة #الهلال_الخليج', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@azizthemaster @androidkq ايش افضل سامسونج الترا ٢٦ او هو', category: 'mobile', founderVerdict: 'valuable' },
  { text: 'وش افضل لعبة كلمات متقاطعه ايفون عربيه جربته؟', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'مـﻧـــ الخاصــــــ السلام عليكم ايش افضل جوال سامسونج سعره 600 ريال', category: 'mobile', founderVerdict: 'valuable' },
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ #ليله_الجمعه', category: 'mobile', founderVerdict: 'valuable' },
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ #زعماء_الشرقيه', category: 'mobile', founderVerdict: 'valuable' },
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ شاهد المقارنة للنهاية واحكم #الاهلي_اوكلاند', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@SaudiAndroid طيب وش افضل جالكسي من ناحيه الاستخدام والسعر', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@SaudiAndroid بسألك وش افضل طريقة لنقل كل البيانات من ايفون إلى جالكسي؟', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'وش أفضل شريحة جوال؟', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'تقريبا لي فوق السنة شاري لابتوب كل ما احط خلفيه لما اطفي واشغل الجهاز تتغير الخلفية شلتها من الاعدادات ومافرق شيء افيدوني اعاني', category: 'laptop', founderVerdict: 'not_valuable' },
  { text: 'أنا طالبة تصميم داخلي وأحتاج لابتوب يتحمل برامج التخصص مثل AutoCAD و3ds Max وRevit وSketchUp وLumion وPhotoshop وIllustrator محتارة بين هذي الأجهزة', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'اللي عنده معلومة ياليت يفيدها أنا طالبة تصميم داخلي وأحتاج لابتوب يتحمل برامج التخصص محتارة بين هذي الأجهزة', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'لي ساعتين وأنا محتارة بين اشتري أيباد مع كيبورد وقلم أو ماك بوك وبعد تفكير واستشارات تم طلب ماك بوك', category: 'laptop', founderVerdict: 'not_valuable' },
  { text: '@majedandroid وش افضل اشتري تابلت ام لابتوب شخصي .', category: 'laptop', founderVerdict: 'valuable' },
  { text: '@CEOAhmd بما انك مهندس وش افضل لابتوب متحول تنصح فيه ؟', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'ايش افضل لابتوب لتخصص CS??', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'وش تنصحوني لابتوب ل دراسة ؟', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'تخصصي تصميم جرافيك وابغا اخذ لابتوب وش تنصحوني فيه من مواصفات لاني احترت', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'يا اخوان الي تخصصاتهم حاسب باخذ جهاز لابتوب وش افضل نوع ؟ مو شرط يكون افضل شي بس يكون مناسب يعني', category: 'laptop', founderVerdict: 'valuable' },
  { text: '@d7oom4cars وش افضل مكيف بينهم؟', category: 'air_conditioner', founderVerdict: 'valuable' },
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ #الخلود_الاهلي', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@Ws_n4 السؤال وش افضل لابتوب وماك لحفظ للأستخدام الدراسي ؟', category: 'laptop', founderVerdict: 'valuable' },
  { text: '@J1ASAD وش افضل مكيف موفر ل الطاقه', category: 'air_conditioner', founderVerdict: 'valuable' },
];

// Fresh real production batch (2026-08-31 24h read-only audit) — real stored classification +
// real founder outcome (replied_manually/approved -> valuable, dismissed -> not_valuable), pulled
// from demand_opportunities/demand_radar_outcomes. The one still-pending item at audit time
// (ready_for_review, ~24 min old) is correctly excluded — never call an unlabeled post a verdict.
export const FRESH_24H_2026_08_31: LabeledCase[] = [
  { text: 'أحتاج مكيف جري ٣٦٠٠٠ سبليت جداري هل موجود لديكم https://t.co/T83a3eJ8EQ', category: 'air_conditioner', founderVerdict: 'valuable' },
  { text: '@rasees_net #فلة_وسيارات_هدايا_رسيس\n#رسيس_قول_وفعل\n#اليوم_الوطني\nماشاء الله ربي يغنيكم \nانا ابي جوال فقط انسان قنوع 🥹 ربي يرزقني', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'حرانة من الصبح ابغى مكيف 3 طن https://t.co/ecIR7OcBFD', category: 'air_conditioner', founderVerdict: 'not_valuable' },
  { text: 'بموت ابي   ايباد 😭😭😭😭!!!!', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: 'اشياء ابي اسويها بحياتي \n\nبشتري ادوات الكيك حقت المحترفين واسوي كيكه\nبجرب دولاب الخزّاف \nبشتري فرن الفخاار\n اشتري لي كاميرا osmo pocket\n اتعلم على الكروشيه\n اركب خيل', category: 'oven', founderVerdict: 'not_valuable' },
  { text: 'أبي مكيف يلحقني بكل مكان اروح له', category: 'air_conditioner', founderVerdict: 'not_valuable' },
  { text: '@Fluttershy_0048 @STRK2L المشكلة مش بالجامعة انا انجليزي اداب بس اقدر اتعامل معها المشكلة اني مشغول في مليار شئ و ما ابي الجامعة تضيق علي الخناق اكثر و احتاج لابتوب عشان اشتغل من الجامعة لو في استراحا', category: 'laptop', founderVerdict: 'not_valuable' },
  { text: 'السلام عليكم ابي شاشة كويسة لسوني فايف حدود 600', category: 'tv', founderVerdict: 'not_valuable' },
  { text: '@Abdallahhamzeh1 طيب ذي فترة بشتري لابتوب \nوش تنصحوني من لابتوب \nعشان اقدر العب Gta6. على 1080 اعلى ااعدادات 60 فريم.', category: 'laptop', founderVerdict: 'not_valuable' },
  { text: 'ابي جوال يابن احمد 😞 @AzizbagBag https://t.co/ZZZNsxvONh', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@homer_homerp ابي ايفون 17 برو ماكس', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'ابي ايفون فايف سي \nالابيض', category: 'mobile', founderVerdict: 'not_valuable' },
];
