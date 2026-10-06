import { renderToStaticMarkup } from 'react-dom/server';
import { CurrencyTotals } from '@/components/founder/currency-totals';
import { paidCurrencyTotals } from '@/lib/founder/currency-totals';
import type { ExpenseRow } from '@/lib/founder/finance';
import { windowFor } from '@/lib/founder/windows';

const window = windowFor('custom', new Date('2026-10-06T12:00:00Z'), { start: '2026-09-25', end: '2026-10-06' });
const row = (amount: number, currency: string, paid_at: string | null, extra: Partial<ExpenseRow> = {}): ExpenseRow => ({
  amount_original: amount, currency, paid_at, fees: 0, tax: 0, payment_status: 'paid', deleted_at: null,
  service_period_start: null, service_period_end: null, date_precision: 'needs_review', ...extra,
} as ExpenseRow);
const confirmed = [row(8.37, 'USD', '2026-09-29'), row(16.2, 'EUR', '2026-10-01'), row(499, 'SAR', '2026-10-03'), row(21.35, 'USD', '2026-10-04'), row(26.56, 'USD', '2026-10-04'), row(34.95, 'USD', '2026-10-05')];

it('includes all six confirmed payments despite unknown service periods, without mixing currencies', () => {
  expect(paidCurrencyTotals(confirmed, window)).toEqual([{ currency: 'EUR', amount: 16.2 }, { currency: 'SAR', amount: 499 }, { currency: 'USD', amount: 91.23 }]);
  const html = renderToStaticMarkup(<CurrencyTotals rows={confirmed} window={window} />);
  for (const value of ['16.20', '499.00', '91.23', 'USD', 'EUR', 'SAR']) expect(html).toContain(value);
});

it('excludes unpaid, deleted, undated and out-of-window entries; includes both boundary dates', () => {
  const rows = [row(1, 'USD', '2026-09-25'), row(2, 'USD', '2026-10-06'), row(10, 'USD', '2026-10-07'), row(10, 'USD', '2026-09-24'), row(10, 'USD', null), row(10, 'USD', '2026-10-01', { payment_status: 'expected' }), row(10, 'USD', '2026-10-01', { payment_status: 'due' }), row(10, 'USD', '2026-10-01', { deleted_at: '2026-10-02' })];
  expect(paidCurrencyTotals(rows, window)).toEqual([{ currency: 'USD', amount: 3 }]);
  expect(paidCurrencyTotals(rows)).toEqual([{ currency: 'USD', amount: 33 }]);
});

it('includes fees and tax once and retains original values even when converted', () => {
  expect(paidCurrencyTotals([row(10, 'USD', null, { fees: 1, tax: 2, amount_sar: 48.75, fx_rate: 3.75 })])).toEqual([{ currency: 'USD', amount: 13 }]);
  expect(renderToStaticMarkup(<CurrencyTotals rows={[]} />)).toContain('لا مدفوعات');
});
