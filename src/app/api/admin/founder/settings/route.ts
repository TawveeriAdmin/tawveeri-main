import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin } from '@/lib/founder/api';
import { getSetting, setSetting, LedgerValidationError } from '@/lib/founder/ledger';

export const dynamic = 'force-dynamic';
const ALLOWED = new Set(['scenario_inputs', 'summary_hour_riyadh']);

export const GET = withAdmin(async () => NextResponse.json({
  scenario_inputs: (await getSetting('scenario_inputs')) ?? {},
  summary_hour_riyadh: (await getSetting('summary_hour_riyadh')) ?? 8,
}));

export const PATCH = withAdmin(async (req: NextRequest, admin) => {
  const body = (await req.json()) as Record<string, unknown>;
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED.has(key)) throw new LedgerValidationError({ [key]: 'إعداد غير معروف' });
    if (key === 'summary_hour_riyadh' && !(Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 23)) throw new LedgerValidationError({ summary_hour_riyadh: 'ساعة بين 0 و23' });
    await setSetting(key, value, admin.id);
  }
  return NextResponse.json({ ok: true });
});
