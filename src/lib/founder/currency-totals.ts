import type { ExpenseRow } from './finance';
import type { MetricWindow } from './windows';

/** Cash totals retain original currencies; service dates never gate a payment. */
export function paidExpenses(rows: ExpenseRow[], window?: MetricWindow): ExpenseRow[] {
  return rows.filter((row) => {
    if (row.deleted_at || row.payment_status !== 'paid') return false;
    if (!window) return true;
    if (!row.paid_at) return false;
    const paid = new Date(`${row.paid_at}T00:00:00+03:00`).getTime();
    return paid >= window.start.getTime() && paid < window.end.getTime();
  });
}

export function paidCurrencyTotals(rows: ExpenseRow[], window?: MetricWindow) {
  const totals = new Map<string, number>();
  for (const row of paidExpenses(rows, window)) {
    const amount = Number(row.amount_original) + Number(row.fees) + Number(row.tax);
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + amount);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }));
}
