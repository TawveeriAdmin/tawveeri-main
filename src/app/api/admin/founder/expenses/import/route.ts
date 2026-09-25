// POST /api/admin/founder/expenses/import — CSV import of historical expenses. multipart:
// file, mapping (JSON, optional → guessed from headers), dryRun=1 to preview. Idempotent on file
// checksum; duplicate rows (same content hash) are skipped and counted; rejected rows keep reasons.
import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { createServerClient } from '@/lib/database';
import { withAdmin } from '@/lib/founder/api';
import { guessExpenseMapping, prepareExpenseRows, type ExpenseColumnMapping } from '@/lib/founder/csv-import';
import { createAuditLog } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';
type AnyClient = { from: (table: string) => any };

export const POST = withAdmin(async (req: NextRequest, admin) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  const dryRun = ['1', 'true'].includes(String(form.get('dryRun') ?? '').toLowerCase());
  const text = await file.text();
  const supabase = createServerClient() as unknown as AnyClient;

  let mapping: ExpenseColumnMapping | null = null;
  const mappingRaw = form.get('mapping');
  if (typeof mappingRaw === 'string' && mappingRaw.trim()) {
    try { mapping = JSON.parse(mappingRaw); } catch { return NextResponse.json({ error: 'mapping must be valid JSON' }, { status: 400 }); }
  }
  const importId = randomUUID();
  const probe = prepareExpenseRows(text, mapping ?? {}, importId);
  if (!mapping) mapping = guessExpenseMapping(probe.headers);
  const { checksum, headers, results } = prepareExpenseRows(text, mapping, importId);

  const { data: existing } = await supabase.from('founder_expense_imports').select('id, created_at, imported_rows, skipped_duplicates, rejected_rows').eq('file_checksum', checksum).maybeSingle();
  if (existing && !dryRun) return NextResponse.json({ alreadyImported: true, import: existing });

  const okRows = results.filter((r) => r.ok);
  const hashes = okRows.map((r) => r.rowHash as string);
  const dupSet = new Set<string>();
  for (let i = 0; i < hashes.length; i += 200) {
    const { data } = await supabase.from('founder_expenses').select('row_hash').in('row_hash', hashes.slice(i, i + 200)).is('deleted_at', null);
    for (const d of (data ?? []) as Array<{ row_hash: string }>) dupSet.add(d.row_hash);
  }
  const seenInFile = new Set<string>();
  const toInsert = okRows.filter((r) => { const h = r.rowHash as string; if (dupSet.has(h) || seenInFile.has(h)) return false; seenInFile.add(h); return true; });
  const skippedDuplicates = okRows.length - toInsert.length;
  const rejected = results.filter((r) => !r.ok);

  const summary = { checksum, headers, mapping, rowCount: results.length, wouldImport: toInsert.length, skippedDuplicates, rejectedRows: rejected.length, rejectedSamples: rejected.slice(0, 20).map((r) => ({ row: r.index + 2, error: r.error })), preview: toInsert.slice(0, 5).map((r) => r.input) };
  if (dryRun) return NextResponse.json({ dryRun: true, ...summary });

  const { data: imp, error: impError } = await supabase.from('founder_expense_imports').insert({
    id: importId, file_checksum: checksum, original_filename: file.name, column_mapping: mapping, row_count: results.length,
    imported_rows: toInsert.length, skipped_duplicates: skippedDuplicates, rejected_rows: rejected.length, rejected_samples: summary.rejectedSamples, uploaded_by: admin.id,
  }).select('id').single();
  if (impError) throw new Error(impError.message);
  if (toInsert.length) {
    const { error } = await supabase.from('founder_expenses').insert(toInsert.map((r) => ({ ...(r.input as Record<string, unknown>), import_id: imp.id, created_by: admin.id, updated_by: admin.id })));
    if (error) throw new Error(error.message);
  }
  await supabase.from('founder_ledger_audit').insert({ entity: 'import', entity_id: imp.id, action: 'import', after: { file: file.name, ...summary, preview: undefined }, actor: admin.id });
  await createAuditLog({ user_id: admin.id, action: 'founder_expense_import', entity_type: 'founder_import', entity_id: imp.id, details: { rows: results.length, imported: toInsert.length } });
  return NextResponse.json({ importId: imp.id, ...summary });
});
