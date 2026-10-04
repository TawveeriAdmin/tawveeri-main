// Builds the two label-free review pages from the template + sheets. Usage: node build-pages.js
const fs = require('fs');
const dir = __dirname.replace(/\\/g, '/');
const tpl = fs.readFileSync(dir + '/groups.template.html', 'utf8');
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

const attrLabels = {
  watt: 'القدرة', capacity: 'السعة', form: 'الشكل / النوع', condition: 'الحالة', bundle: 'حزمة / ملحقات', region: 'النسخة / المنطقة',
  size: 'حجم الشاشة', panel: 'نوع اللوحة', refresh: 'معدل التحديث', resolution: 'الدقة',
};

const pages = [
  {
    file: 'vacuum32.html', sheet: 'vacuum32-sheet.json',
    title: 'مراجعة مكانس المجموعات العائلية',
    intro: 'اثنتان وثلاثون مجموعة من المكانس. كل مجموعة فيها إعلانان أو ثلاثة من متاجر مختلفة. لا تُعرض عليك أي نتيجة من النظام ولا مفتاح هوية، فقط ما يراه المتسوّق وما يصرّح به التاجر. السؤال ضيق: لو اشترى شخص الإعلان الأرخص بدل أي إعلان آخر في المجموعة، هل يصله نفس الجهاز بالضبط — نفس الموديل والقدرة والسعة والنوع والملحقات؟ «نفس الماركة» أو «نفس القدرة» أو «نفس الخط» لا تكفي. إن لم تكفِ المعلومات للجزم فاختر «نفس العائلة ولا يكفي الدليل». رابط كل إعلان يفتح صفحته عند التاجر إن احتجت التأكد.',
    question: 'لو اشترى شخص الأرخص بدل أي إعلان آخر هنا، هل يصله نفس الجهاز بالضبط؟',
    collection: 'vacuum32', prefix: 'v32', sameKey: 'SAME_EXACT_COMMERCIAL_VARIANT', showTitleModel: false,
    options: [
      { k: 'SAME_EXACT_COMMERCIAL_VARIANT', c: 'same', ar: 'نفس الجهاز بالضبط', en: 'SAME EXACT VARIANT' },
      { k: 'SAME_FAMILY_NOT_ENOUGH_EVIDENCE', c: 'fam', ar: 'نفس العائلة ولا يكفي الدليل', en: 'SAME FAMILY — NOT ENOUGH EVIDENCE' },
      { k: 'DIFFERENT_VARIANT', c: 'diff', ar: 'جهاز أو إصدار مختلف', en: 'DIFFERENT VARIANT' },
      { k: 'UNSURE', c: 'unsure', ar: 'لا أستطيع الجزم', en: 'UNSURE' },
    ],
  },
  {
    file: 'tv22.html', sheet: 'tv22-sheet.json',
    title: 'مراجعة تلفزيونات المجموعات المتغيّرة',
    intro: 'اثنتان وعشرون مجموعة من التلفزيونات (٢–٤ إعلانات لكل منها). لا يُعرض عليك أي قرار من النظام. تُعرض لك حقول الموديل التي يصرّح بها التاجر، والرمز الذي يمكن قراءته من العنوان، والمفتاح، وحجم الشاشة والنوع والتحديث والدقة. السؤال ضيق: لو اشترى شخص الإعلان الأرخص بدل أي إعلان آخر في المجموعة، هل يصله نفس التلفزيون بالضبط؟ رمزان مختلفان مكتوبان صراحة (مثل 85T8D و85C6K PRO) يعنيان إصدارين مختلفين. حقل «model» العام كثيرًا ما يكون جزءًا من العنوان وليس رقم موديل.',
    question: 'لو اشترى شخص الأرخص بدل أي إعلان آخر هنا، هل يصله نفس التلفزيون بالضبط؟',
    collection: 'tv22', prefix: 'tv22', sameKey: 'SAME_EXACT_COMMERCIAL_VARIANT', showTitleModel: true,
    options: [
      { k: 'SAME_EXACT_COMMERCIAL_VARIANT', c: 'same', ar: 'نفس التلفزيون بالضبط', en: 'SAME EXACT VARIANT' },
      { k: 'DIFFERENT_VARIANT', c: 'diff', ar: 'تلفزيون أو إصدار مختلف', en: 'DIFFERENT VARIANT' },
      { k: 'REVIEW_INSUFFICIENT_EVIDENCE', c: 'unsure', ar: 'الدليل لا يكفي للجزم', en: 'REVIEW / INSUFFICIENT EVIDENCE' },
    ],
  },
];

for (const p of pages) {
  const sheet = JSON.parse(fs.readFileSync(dir + '/' + p.sheet, 'utf8'));
  const cfg = { collection: p.collection, prefix: p.prefix, sameKey: p.sameKey, question: p.question, options: p.options, showTitleModel: p.showTitleModel, attrLabels };
  let h = tpl;
  const rep = (a, b) => { if (!h.includes(a)) throw new Error('missing ' + a); h = h.split(a).join(b); };
  rep('__TITLE__', p.title); rep('__INTRO__', p.intro);
  rep('__NOPT__', String(p.options.length)); rep('__N__', String(sheet.length)); rep('__NAR__', AR(sheet.length));
  rep('__SHEET__', JSON.stringify(sheet)); rep('__CFG__', JSON.stringify(cfg));
  fs.writeFileSync(dir + '/' + p.file, h);
  console.log(p.file, sheet.length, 'groups', h.length, 'bytes');
}
