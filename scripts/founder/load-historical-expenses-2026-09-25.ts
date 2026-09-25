// scripts/founder/load-historical-expenses-2026-09-25.ts
// One-off, idempotent load of the founder's documented historical expenses (mandate 2026-09-25,
// "مهمة مالية فقط") through the audited ledger — never a raw insert. Rules applied verbatim:
//   * remove ONLY the temporary 2,000 SAR aggregate entry (matched by id, vendor and amount);
//   * dedup key = date + vendor + reference + amount (row_hash; unique index rejects a re-run);
//   * original currency kept, SAR equivalent as supplied (rate 3.75, source recorded);
//   * missing dates are NOT guessed: date_precision = 'needs_review', dates left empty;
//   * X/TikTok campaigns → advertising; Claude/ChatGPT → ai; contractors → contractor,
//     one_time, tagged «سابق/متوقف/تكلفة غير مستردة»; nothing recurring for the failed contracts;
//   * exclusions (refunded Claude Pro, iCloud+, failed Browserless/Firecrawl renewals, unpaid 17,000)
//     are simply not present in the lists below;
//   * Amazon 77 SAR → founder_revenue_entries state 'pending' (never paid/confirmed cash).
// Usage: npx tsx scripts/founder/load-historical-expenses-2026-09-25.ts [--dry]
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { createHash } from 'crypto';
import { createServerClient } from '../../src/lib/database';
import { createExpense, createRevenue, softDeleteExpense, type ExpenseInput } from '../../src/lib/founder/ledger';
import { fetchExpenses, fetchRevenueEntries, totalSinceStart, expenseSar } from '../../src/lib/founder/finance';

const DRY = process.argv.includes('--dry');
const FX = 3.75;
const FX_SOURCE = 'تقدير 3.75 ريال/دولار — قائمة المؤسس المستخرجة من فواتير البريد (2026-09-25)';
const TEMP_ENTRY_ID = 'eb75dd57-95c8-4552-b5c6-4fc38fed6188';
const DELETE_NOTE = 'استبدال بسجل مصروفات تاريخي موثق';

type Cat = ExpenseInput['category'];
interface Row { date: string | null; vendor: string; label: string; category: Cat; amount: number; currency: 'USD' | 'SAR'; sar: number; ref: string; recurrence?: string; notes?: string; costKind?: string; evidenceState?: 'documented' | 'estimate' }

// Section 3 — email invoices (USD, paid).
const EMAIL: Row[] = [
  ['2026-02-24', 'SendGrid', 'Email delivery', 'hosting', 3.56, 13.35, 'P-18740752'],
  ['2026-02-24', 'SendGrid', 'Email delivery', 'hosting', 2.68, 10.05, 'P-18740747'],
  ['2026-03-04', 'SendGrid', 'Email delivery', 'hosting', 34.95, 131.0625, 'P-18946915'],
  ['2026-03-05', 'Supabase', 'Database and backend', 'hosting', 34.11, 127.9125, 'JGMNQC-00004'],
  ['2026-04-04', 'Supabase', 'Database and backend', 'hosting', 35.18, 131.925, 'JGMNQC-00005'],
  ['2026-04-06', 'SendGrid', 'Email delivery', 'hosting', 34.95, 131.0625, 'P-19149008'],
  ['2026-05-03', 'Railway', 'Hosting and compute', 'hosting', 5.0, 18.75, '2853-7491 / RGXEX8CS-0001'],
  ['2026-05-04', 'Supabase', 'Database and backend', 'hosting', 34.86, 130.725, 'JGMNQC-00006'],
  ['2026-05-05', 'SendGrid', 'Email delivery', 'hosting', 34.95, 131.0625, 'P-19412570'],
  ['2026-06-01', 'Anthropic', 'AI API credits', 'ai', 5.75, 21.5625, '2080-5042-9025 / GZLQKZTV-0001'],
  ['2026-06-03', 'SendGrid', 'Email delivery', 'hosting', 34.95, 131.0625, 'P-19704668'],
  ['2026-06-04', 'Railway', 'Hosting and compute', 'hosting', 15.61, 58.5375, '2127-1196 / RGXEX8CS-0003'],
  ['2026-06-04', 'Supabase', 'Database and backend', 'hosting', 35.19, 131.9625, 'JGMNQC-00007'],
  ['2026-07-03', 'SendGrid', 'Email delivery', 'hosting', 34.95, 131.0625, 'P-20085154'],
  ['2026-07-04', 'Railway', 'Hosting and compute', 'hosting', 203.29, 762.3375, '2007-1404 / RGXEX8CS-0004'],
  ['2026-07-04', 'Supabase', 'Database and backend', 'hosting', 34.86, 130.725, 'JGMNQC-00008'],
  ['2026-07-25', 'Store Leads', 'Market research data', 'other', 75.0, 281.25, 'VM8GDVEP-0001'],
  ['2026-08-04', 'Railway', 'Hosting and compute', 'hosting', 47.61, 178.5375, '2448-0353 / RGXEX8CS-0005'],
  ['2026-08-04', 'Supabase', 'Database and backend', 'hosting', 35.19, 131.9625, 'JGMNQC-00009'],
  ['2026-08-04', 'SendGrid', 'Email delivery', 'hosting', 34.95, 131.0625, 'P-20408428'],
  ['2026-08-08', 'Browserless', 'Browser automation', 'data_extraction', 200.0, 750.0, '2421-3833 / R0NT97NL-0002'],
  ['2026-08-31', 'Anthropic', 'AI API credits', 'ai', 23.0, 86.25, '2437-7637-1714 / GZLQKZTV-0002'],
  ['2026-09-03', 'SendGrid', 'Email delivery', 'hosting', 34.95, 131.0625, 'P-20721568'],
  ['2026-09-04', 'Railway', 'Hosting and compute', 'hosting', 20.0, 75.0, '2225-3071 / RGXEX8CS-0006'],
  ['2026-09-04', 'Supabase', 'Database and backend', 'hosting', 35.19, 131.9625, 'JGMNQC-00010'],
].map(([date, vendor, label, category, amount, sar, ref]) => ({ date: date as string, vendor: vendor as string, label: label as string, category: category as Cat, amount: amount as number, currency: 'USD' as const, sar: sar as number, ref: ref as string, recurrence: 'monthly' }));

// Section 4 — Apple purchases (SAR, paid).
const APPLE: Row[] = [
  { date: '2026-07-03', vendor: 'Claude Max 5x', label: 'AI software subscription', category: 'ai', amount: 499.99, currency: 'SAR', sar: 499.99, ref: 'Apple purchase history 2026-07-03', recurrence: 'monthly', notes: 'Monthly subscription' },
  { date: '2026-07-20', vendor: 'ChatGPT Plus', label: 'AI software subscription', category: 'ai', amount: 89.99, currency: 'SAR', sar: 89.99, ref: 'Apple purchase history 2026-07-20', recurrence: 'monthly', notes: 'Monthly subscription' },
  { date: '2026-08-03', vendor: 'Claude Max 5x', label: 'AI software subscription', category: 'ai', amount: 499.99, currency: 'SAR', sar: 499.99, ref: 'Apple purchase history 2026-08-03', recurrence: 'monthly', notes: 'Monthly subscription' },
  { date: '2026-08-14', vendor: 'X Premium', label: 'Marketing tools', category: 'tools', amount: 15.0, currency: 'SAR', sar: 15.0, ref: 'Apple purchase history 2026-08-14', recurrence: 'monthly', notes: 'Monthly subscription for Tawveeri X account' },
  { date: '2026-08-14', vendor: 'TikTok Promote', label: 'Paid marketing campaign', category: 'advertising', amount: 29.5, currency: 'SAR', sar: 29.5, ref: 'Apple purchase history 2026-08-14', notes: 'TikTok promotion' },
  { date: '2026-09-03', vendor: 'Claude Max 5x', label: 'AI software subscription', category: 'ai', amount: 499.99, currency: 'SAR', sar: 499.99, ref: 'Apple purchase history 2026-09-03', recurrence: 'monthly', notes: 'Monthly subscription' },
  { date: '2026-09-11', vendor: 'X Premium', label: 'Marketing tools', category: 'tools', amount: 15.0, currency: 'SAR', sar: 15.0, ref: 'Apple purchase history 2026-09-11', recurrence: 'monthly', notes: 'Monthly subscription for Tawveeri X account' },
  { date: '2026-09-11', vendor: 'TikTok Promote', label: 'Paid marketing campaign', category: 'advertising', amount: 73.75, currency: 'SAR', sar: 73.75, ref: 'Apple purchase history 2026-09-11', notes: 'TikTok promotion' },
  { date: null, vendor: 'X Promote', label: 'Paid marketing campaign', category: 'advertising', amount: 39.99, currency: 'SAR', sar: 39.99, ref: 'Apple purchase history — undated #1', notes: 'Apple purchase history; date not visible in supplied image' },
  { date: null, vendor: 'X Promote', label: 'Paid marketing campaign', category: 'advertising', amount: 39.99, currency: 'SAR', sar: 39.99, ref: 'Apple purchase history — undated #2', notes: 'Apple purchase history; date not visible in supplied image' },
  { date: '2026-09-18', vendor: 'TikTok Promote', label: 'Paid marketing campaign', category: 'advertising', amount: 116.39, currency: 'SAR', sar: 116.39, ref: 'Apple purchase history 2026-09-18', notes: 'TikTok promotion' },
];

// Section 5 — stopped external development (SAR, paid, non-recurring, non-recoverable).
const CONTRACTORS: Row[] = [
  { date: null, vendor: 'External technology company', label: 'Product development / external contractor', category: 'contractor', amount: 16000, currency: 'SAR', sar: 16000, ref: 'Founder statement 2026-09-25 — contract stopped', notes: 'سابق/متوقف/تكلفة غير مستردة. Original contract was 33000 SAR; founder stopped it due to poor delivery; only 16000 SAR was paid. The unpaid 17000 SAR is NOT recorded.' },
  { date: null, vendor: 'Independent developer', label: 'Product development / external contractor', category: 'contractor', amount: 4000, currency: 'SAR', sar: 4000, ref: 'Founder statement 2026-09-25 — no usable deliverable', notes: 'سابق/متوقف/تكلفة غير مستردة. No usable deliverable (files sent compressed, no usable value). Non-recurring, non-recoverable.' },
];

const keyHash = (r: Row) => createHash('sha256').update(['historical-2026-09-25', r.date ?? 'DATE_NEEDS_REVIEW', r.vendor, r.ref, r.amount.toFixed(2), r.currency].join('|')).digest('hex');

function toInput(r: Row): ExpenseInput {
  const needsReview = r.date === null;
  return {
    vendor: r.vendor, description: r.label, category: r.category,
    date_precision: needsReview ? 'needs_review' : 'exact',
    service_period_start: r.date ?? undefined as unknown as string, service_period_end: r.date ?? null, paid_at: r.date ?? null, payment_status: 'paid',
    amount_original: r.amount, currency: r.currency, fees: 0, tax: 0,
    ...(r.currency === 'USD' ? { fx_rate: FX, fx_source: FX_SOURCE, amount_sar: r.sar } : {}),
    recurrence: r.recurrence ?? 'one_time', evidence_ref: r.ref, evidence_state: r.evidenceState ?? 'documented', cost_kind: 'direct',
    notes: [r.notes, needsReview ? 'تاريخ تاريخي يحتاج مراجعة — التاريخ غير ظاهر في الدليل المقدم' : null].filter(Boolean).join(' · ') || null,
    row_hash: keyHash(r),
  };
}

async function main() {
  const supabase = createServerClient() as unknown as { from: (t: string) => any };
  const { data: admin } = await supabase.from('users').select('id').eq('role', 'admin').limit(1).single();
  const actor: string = admin.id;

  // 1. The temporary aggregate entry — matched by id AND vendor AND amount; anything else is untouched.
  const { data: temp } = await supabase.from('founder_expenses').select('id, vendor, description, amount_original, currency, deleted_at').eq('id', TEMP_ENTRY_ID).maybeSingle();
  const isTemp = temp && !temp.deleted_at && Number(temp.amount_original) === 2000 && temp.currency === 'SAR' && temp.vendor === 'ذكاء اصطناعي';
  const { data: other2000 } = await supabase.from('founder_expenses').select('id, vendor').eq('amount_original', 2000).is('deleted_at', null).neq('id', TEMP_ENTRY_ID);
  console.log(JSON.stringify({ tempEntry: temp, matchesTemporaryEntry: !!isTemp, other2000RowsLeftUntouched: other2000 ?? [] }));
  if (isTemp && !DRY) { await softDeleteExpense(TEMP_ENTRY_ID, actor, DELETE_NOTE); console.log('deleted temporary entry', TEMP_ENTRY_ID); }

  // 2. Expenses, deduped by row_hash (unique partial index + pre-check so a re-run reports, not fails).
  const rows = [...EMAIL, ...APPLE, ...CONTRACTORS];
  const hashes = rows.map(keyHash);
  const { data: existing } = await supabase.from('founder_expenses').select('row_hash').in('row_hash', hashes).is('deleted_at', null);
  const have = new Set(((existing ?? []) as Array<{ row_hash: string }>).map((e) => e.row_hash));
  let inserted = 0, skipped = 0;
  for (const r of rows) {
    if (have.has(keyHash(r))) { skipped += 1; continue; }
    if (!DRY) await createExpense(toInput(r), actor);
    inserted += 1;
  }
  console.log(JSON.stringify({ expensesInList: rows.length, inserted, skippedAsDuplicates: skipped, dry: DRY }));

  // 3. Amazon pending commission — expected, not cash.
  const revs = await fetchRevenueEntries();
  const hasAmazon = revs.some((r) => r.source === 'amazon_associates' && r.state === 'pending' && Number(r.commission_amount) === 77);
  if (!hasAmazon && !DRY) {
    await createRevenue({ source: 'amazon_associates', state: 'pending', commission_amount: 77, currency: 'SAR', unit: 'aggregate',
      period_start: '2026-09-01', period_end: '2026-09-30', report_ref: 'Amazon Associates — expected payout (founder statement 2026-09-25)',
      notes: 'Commission expected to be deposited. Pending/expected, NOT cash received, until the bank payout is confirmed. الفترة المسجلة (سبتمبر 2026) للعرض فقط حتى مطابقة تقرير الشريك.' }, actor);
  }
  console.log(JSON.stringify({ amazonPendingAlreadyPresent: hasAmazon }));

  // 4. Verification totals (from the same functions the center uses).
  const all = (await fetchExpenses()).filter((e) => e.payment_status === 'paid');
  const sum = (pred: (e: (typeof all)[number]) => boolean) => Math.round(all.filter(pred).reduce((s, e) => s + (expenseSar(e) ?? 0), 0) * 100) / 100;
  const infra = sum((e) => ['hosting', 'data_extraction', 'ai', 'tools', 'other'].includes(e.category));
  const infraNoTools = sum((e) => ['hosting', 'data_extraction', 'ai'].includes(e.category));
  const marketing = sum((e) => e.category === 'advertising' || e.vendor === 'X Premium');
  const contractors = sum((e) => e.category === 'contractor');
  const revNow = await fetchRevenueEntries();
  const paidSar = revNow.filter((r) => r.state === 'paid').reduce((s, r) => s + Number(r.amount_sar ?? r.commission_amount), 0);
  const pendingAmazon = revNow.filter((r) => r.source === 'amazon_associates' && r.state === 'pending').reduce((s, r) => s + Number(r.amount_sar ?? r.commission_amount), 0);
  const total = totalSinceStart(all);
  console.log(JSON.stringify({
    paidExpenseRows: all.length,
    infrastructureAndSoftwareSar: infra, ofWhich: { hostingDataAi: infraNoTools, xPremiumTools: sum((e) => e.vendor === 'X Premium'), storeLeadsResearch: sum((e) => e.vendor === 'Store Leads') },
    marketingPaidSar: marketing, ofWhichCampaignsOnly: sum((e) => e.category === 'advertising'),
    stoppedExternalDevelopmentSar: contractors,
    totalHistoricalPaidSar: total.sar, undatedRows: total.undatedRows, unconvertedRows: total.unconvertedRows,
    revenueReceivedSar: paidSar, amazonPendingSar: pendingAmazon,
  }, null, 1));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exit(1); });
