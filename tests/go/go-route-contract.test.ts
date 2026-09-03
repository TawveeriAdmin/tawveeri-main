// tests/go/go-route-contract.test.ts — src/app/go/[offerId]/route.ts
// ADR-286 regression gate. Structural contract checks, matching this codebase's established
// convention for Next route handlers (tests/campaigns/click-route-contract.test.ts) — no test
// in this codebase constructs a live NextRequest for a route handler, this one included.
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/app/go/[offerId]/route.ts'), 'utf8');

describe('GET /go/[offerId] — arbitrary GET / render token alone never creates decision-grade customer traction', () => {
  it('NEVER writes to first_party_interactions — only /api/interactions (a real onClick) can create a decision-grade row', () => {
    expect(source).not.toMatch(/\.from\((["'])first_party_interactions\1\)/);
  });

  it('interaction_provenance is typed and assigned only "render_token_valid" or "raw_request" — never "first_party_ui_interaction" as an actual value (the file may still explain the distinction in prose comments)', () => {
    expect(source).toMatch(/"render_token_valid"\s*\|\s*"raw_request"\s*\|\s*null/);
    // Not assigned as a literal value anywhere (ternary result, ...spread, ':' type-adjacent
    // assignment) — only ever appears in explanatory prose comparing it to render_token_valid.
    expect(source).not.toMatch(/[:=]\s*["']first_party_ui_interaction["']/);
    expect(source).not.toMatch(/\?\s*["']first_party_ui_interaction["']/);
  });

  it('a request with no gt token verifies to invalid and is classified raw_request, never render_token_valid', () => {
    expect(source).toMatch(/goTokenValid\s*=\s*provenanceEnabled\s*\n?\s*\?\s*verifyGoToken\(offerId, req\.nextUrl\.searchParams\.get\(["']gt["']\)\)\.valid/);
    expect(source).toMatch(/goTokenValid \? ["']render_token_valid["'] : ["']raw_request["']/);
  });

  it('interaction_id is stored VERBATIM and UNVALIDATED against any ledger — this route never looks it up, never uses it to classify anything', () => {
    expect(source).toMatch(/Stored VERBATIM, UNVALIDATED/);
    expect(source).not.toMatch(/\.from\((["'])first_party_interactions\1\)\.select/);
  });

  it('both interaction_provenance and interaction_id are OMITTED from the insert entirely when absent — never written as a falsy placeholder that could later be misread as a real classification', () => {
    expect(source).toMatch(/\.\.\.\(interactionProvenance \? \{ interaction_provenance: interactionProvenance \} : \{\}\)/);
    expect(source).toMatch(/\.\.\.\(interactionId \? \{ interaction_id: interactionId \} : \{\}\)/);
  });

  it('the outbound_clicks insert is fire-and-forget (.then, never awaited) and the redirect does not depend on its result', () => {
    const insertIdx = source.indexOf('.insert({');
    const thenIdx = source.indexOf('.then(({ error: e })');
    const redirectIdx = source.lastIndexOf('return NextResponse.redirect(link.url, 302);');
    expect(insertIdx).toBeGreaterThan(-1);
    expect(thenIdx).toBeGreaterThan(insertIdx);
    expect(redirectIdx).toBeGreaterThan(thenIdx);
    // No `await` immediately precedes the insert call — it is a bare fire-and-forget chain.
    const beforeInsert = source.slice(Math.max(0, insertIdx - 30), insertIdx);
    expect(beforeInsert).not.toMatch(/await\s*$/);
  });

  it('the redirect always fires — the insert error is only ever console.error-logged, never used to alter or block the response', () => {
    expect(source).toMatch(/if \(e\) console\.error\("outbound_clicks insert failed:", e\.message\);/);
    // the redirect statement is unconditional (not inside the .then callback)
    const thenBlockEnd = source.indexOf('});', source.indexOf('.then(({ error: e })'));
    const redirectIdx = source.lastIndexOf('return NextResponse.redirect(link.url, 302);');
    expect(redirectIdx).toBeGreaterThan(thenBlockEnd);
  });

  it('interaction_id is only ever accepted when the SAME provenanceEnabled flag is on, so it can never be inserted before its migration column exists', () => {
    expect(source).toMatch(/const interactionId =\s*\n?\s*provenanceEnabled && rawInteractionId/);
  });
});
