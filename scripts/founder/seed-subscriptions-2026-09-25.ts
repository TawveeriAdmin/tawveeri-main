// scripts/founder/seed-subscriptions-2026-09-25.ts — founder mandate (second finance task).
// Fixed subscriptions (reviewable), variable budgets derived from the last three paid invoices of
// each variable vendor (estimate only, never auto-repeated), and two NEEDS_CONFIRMATION entries.
// Idempotent by vendor. Usage: DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/founder/seed-subscriptions-2026-09-25.ts
import { createServerClient } from '../../src/lib/database';
import { createSubscription, fetchSubscriptions, materializeExpectedExpenses } from '../../src/lib/founder/subscriptions';
import { fetchExpenses, expenseSar } from '../../src/lib/founder/finance';

async function main() {
  const supabase = createServerClient() as unknown as { from: (t: string) => any };
  const { data: admin } = await supabase.from('users').select('id').eq('role', 'admin').limit(1).single();
  const actor: string = admin.id;
  const existing = new Set((await fetchSubscriptions()).map((s) => s.vendor));
  const expenses = await fetchExpenses();
  const avgLast3 = (vendor: string) => {
    const rows = expenses.filter((e) => e.vendor === vendor && e.payment_status === 'paid' && e.paid_at).sort((a, b) => (b.paid_at! > a.paid_at! ? 1 : -1)).slice(0, 3);
    const vals = rows.map((e) => expenseSar(e)).filter((v): v is number => v != null);
    return vals.length ? { value: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100, source: `متوسط آخر ${vals.length} فواتير مدفوعة (${rows.map((r) => r.paid_at).join('، ')})` } : null;
  };
  const plan: Array<Parameters<typeof createSubscription>[0]> = [
    { vendor: 'Claude Max 5x', description: 'AI software subscription', category: 'ai', kind: 'fixed', amount_sar: 499.99, currency: 'SAR', next_renewal_at: '2026-10-03', last_confirmed_at: '2026-09-03', notes: 'شهري — القيد يصبح مدفوعًا بعد تأكيد الفاتورة/الخصم' },
    { vendor: 'ChatGPT Plus', description: 'AI software subscription', category: 'ai', kind: 'fixed', amount_sar: 89.99, currency: 'SAR', next_renewal_at: '2026-10-20', last_confirmed_at: '2026-07-20', notes: 'شهري — آخر شراء مثبت 2026-07-20؛ راجع إن كان لا يزال فعالًا' },
    { vendor: 'X Premium', description: 'Marketing tools', category: 'tools', kind: 'fixed', amount_sar: 15, currency: 'SAR', next_renewal_at: '2026-10-11', last_confirmed_at: '2026-09-11', notes: 'شهري لحساب توفيري على X' },
    ...['Railway', 'Supabase', 'SendGrid', 'Anthropic'].map((vendor) => { const b = avgLast3(vendor); return { vendor, description: vendor === 'Anthropic' ? 'AI API credits — متغير' : 'Hosting/infra — متغير', category: (vendor === 'Anthropic' ? 'ai' : 'hosting') as 'ai' | 'hosting', kind: 'variable_budget' as const, amount_sar: b?.value ?? 0, currency: 'SAR', budget_source: b?.source ?? 'لا فواتير كافية', notes: 'لا يُكرر تلقائيًا — أدخل الفاتورة الفعلية شهريًا' }; }),
    { vendor: 'Store Leads', description: 'Market research data', category: 'other', kind: 'fixed', status: 'needs_confirmation', amount_sar: 281.25, currency: 'SAR', notes: 'لا يُنشأ التزام متكرر حتى يؤكد المؤسس أنه لا يزال فعالًا' },
    { vendor: 'Browserless', description: 'Browser automation', category: 'data_extraction', kind: 'fixed', status: 'needs_confirmation', amount_sar: 750, currency: 'SAR', notes: 'تجديد سبتمبر فشل وأُلغي؛ لا يُنشأ التزام متكرر حتى يؤكد المؤسس' },
  ];
  let created = 0;
  for (const p of plan) { if (existing.has(p.vendor)) continue; await createSubscription(p, actor); created += 1; }
  const mat = await materializeExpectedExpenses(actor);
  console.log(JSON.stringify({ created, skipped: plan.length - created, materialized: mat, subscriptions: (await fetchSubscriptions()).map((s) => ({ vendor: s.vendor, kind: s.kind, status: s.status, sar: s.amount_sar, next: s.next_renewal_at, budget: s.budget_source })) }, null, 1));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exit(1); });
