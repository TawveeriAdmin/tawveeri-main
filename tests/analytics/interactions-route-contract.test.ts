// tests/analytics/interactions-route-contract.test.ts — src/app/api/interactions/route.ts
// ADR-286 regression gate. Structural contract checks, matching this codebase's established
// convention for Next route handlers (tests/campaigns/click-route-contract.test.ts) rather
// than constructing a live NextRequest — no test in this codebase does that for any route
// handler, including the pre-existing /go/[offerId]/route.ts.
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/interactions/route.ts'), 'utf8');

describe('POST /api/interactions — server owns every classification field', () => {
  it('never reads provenance from the request body — it is always server-computed', () => {
    expect(source).not.toMatch(/body\.provenance/);
    expect(source).toMatch(/provenance:\s*\(?isAdminCookie/);
  });

  it('never reads is_test from the request body — it is always server-computed from trusted signals', () => {
    expect(source).not.toMatch(/body\.is_test/);
    expect(source).toMatch(/const isTest =/);
  });

  it('never reads session_id from the request body — it reads the SAME tw_sid cookie /go reads server-side', () => {
    expect(source).not.toMatch(/body\.session_id/);
    expect(source).toMatch(/req\.cookies\.get\(["']tw_sid["']\)/);
  });

  it('validates interaction_id format before ever touching the database', () => {
    expect(source).toMatch(/ID_RE\.test\(interactionId\)/);
    // the format guard must run before the Supabase call
    expect(source.indexOf('ID_RE.test(interactionId)')).toBeLessThan(source.indexOf('.upsert('));
  });

  it('validates go_id against a UUID / ps_<uuid> shape — a malformed value is neutralized to null, not stored verbatim', () => {
    expect(source).toMatch(/GO_ID_RE\.test\(rawGoId\)/);
    expect(source).toMatch(/const goId = rawGoId && GO_ID_RE\.test\(rawGoId\) \? rawGoId : null;/);
  });

  it('validates canonical_id against a UUID shape', () => {
    expect(source).toMatch(/UUID_RE\.test\(rawCanonicalId\)/);
  });

  it('validates surface against an allowlist — an unrecognized value is neutralized, not trusted verbatim', () => {
    expect(source).toMatch(/KNOWN_SURFACES\.has\(rawSurface\)/);
    expect(source).toMatch(/const surface = KNOWN_SURFACES\.has\(rawSurface\) \? rawSurface : ["']unknown["'];/);
  });

  it('derives an authenticated-staff-session signal via the trusted auth helper, not a client-declared flag', () => {
    expect(source).toMatch(/getUser\(\)/);
    expect(source).toMatch(/isStaffSession/);
  });

  it('a staff/admin session is classified internal_test, not first_party_ui_interaction', () => {
    expect(source).toMatch(/provenance:\s*\(isAdminCookie \|\| isStaffSession\) \? ["']internal_test["'] : ["']first_party_ui_interaction["']/);
  });

  it('upserts with onConflict on interaction_id and ignoreDuplicates — a retried POST cannot create a second row', () => {
    expect(source).toMatch(/onConflict:\s*["']interaction_id["']/);
    expect(source).toMatch(/ignoreDuplicates:\s*true/);
  });

  it('the whole handler is wrapped in try/catch and always resolves 204 — a thrown error can never hang the client, which has already navigated away regardless', () => {
    expect(source).toMatch(/try \{[\s\S]*catch \{[\s\S]*return new NextResponse\(null, \{ status: 204 \}\);[\s\S]*\}/);
  });

  it('never awaits anything before the client-visible response in a way that could delay navigation — the DB write is the last statement in the try block, and the function is fire-and-forget from the caller\'s perspective (recordFirstPartyInteraction never awaits this endpoint)', () => {
    // Structural proxy: the upsert is the last meaningful statement before the catch block —
    // i.e. nothing reads its result to decide what to respond with.
    const upsertIdx = source.indexOf('.upsert(');
    // There are two `} catch {` blocks — an inner one guarding the getUser() staff-session
    // check, and the outer one wrapping the whole handler. The outer one is what must follow
    // the upsert; lastIndexOf finds it (indexOf would find the inner one, which sits earlier
    // in the file than the upsert call and would falsely fail this assertion).
    const outerCatchIdx = source.lastIndexOf('} catch {');
    expect(upsertIdx).toBeGreaterThan(-1);
    expect(upsertIdx).toBeLessThan(outerCatchIdx);
  });
});
