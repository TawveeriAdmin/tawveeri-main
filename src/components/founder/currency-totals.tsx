import { paidCurrencyTotals } from '@/lib/founder/currency-totals';
import type { ExpenseRow } from '@/lib/founder/finance';
import type { MetricWindow } from '@/lib/founder/windows';

export function CurrencyTotals({ rows, window }: { rows: ExpenseRow[]; window?: MetricWindow }) {
  const totals = paidCurrencyTotals(rows, window);
  if (!totals.length) return <span>لا مدفوعات</span>;
  return <span className="inline-flex flex-wrap gap-x-4 gap-y-1">{totals.map(({ currency, amount }) => (
    <span key={currency} dir="ltr" className="whitespace-nowrap tabular-nums">{amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
  ))}</span>;
}
