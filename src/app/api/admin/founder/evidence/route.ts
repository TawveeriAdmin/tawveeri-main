// Evidence attachments (receipts, partner report screenshots) in a PRIVATE Supabase Storage
// bucket. Upload returns the object path to store on the ledger row; GET returns a short-lived
// signed URL for the admin to view it. Never public.
import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { createServerClient } from '@/lib/database';
import { withAdmin } from '@/lib/founder/api';

export const dynamic = 'force-dynamic';
const BUCKET = 'founder-evidence';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/csv', 'text/plain']);

async function ensureBucket(supabase: any) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES });
}

export const POST = withAdmin(async (req: NextRequest, admin) => {
  const form = await req.formData();
  const file = form.get('file');
  const entity = String(form.get('entity') ?? 'misc').replace(/[^a-z_]/g, '').slice(0, 20) || 'misc';
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file too large (max 10MB)' }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: `unsupported type ${file.type}` }, { status: 400 });
  const supabase = createServerClient() as any;
  await ensureBucket(supabase);
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  const path = `${entity}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return NextResponse.json({ path, uploadedBy: admin.id, name: file.name, size: file.size });
});

export const GET = withAdmin(async (req: NextRequest) => {
  const path = req.nextUrl.searchParams.get('path');
  if (!path || path.includes('..')) return NextResponse.json({ error: 'path required' }, { status: 400 });
  const supabase = createServerClient() as any;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return NextResponse.json({ url: data.signedUrl, expiresInSeconds: 300 });
});
