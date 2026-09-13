// scripts/tps-analysis/resolve-residual-identities.ts
// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY, bounded, Samsung-only. Phase A denominator closure (2026-09-13).
//
// For the residual URLs whose commercial identity could not be computed from
// title/meta text alone, fetch the PDP's own labeled spec table
// (`.pdd32-product-spec__content-item-title` / `-desc` — confirmed present and
// consistent across monitor/tablet/etc. PDP templates) and reformat known
// label:value pairs into the phrasing each category plugin's EXISTING regex
// extractor already expects (e.g. "Storage (GB): 64" -> "64GB"), then run the
// SAME live detect()/normalize()/buildIdentityKey() pipeline used everywhere
// else. No parallel identity logic — this only gives the real plugins more of
// the same evidence a fuller title would have carried.
//
// No DB writes. Read-only classification only.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { CATEGORY_DEFS } from '../tps-core/category-registry';

interface Resolved {
  url: string;
  title: string | null;
  specCount: number;
  syntheticText: string;
  computedIdentityKey: string | null;
  computedCategory: string | null;
  identityStatus: string | null;
}

function specsToSyntheticText(specs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [label, rawValue] of Object.entries(specs)) {
    // Samsung's refrigerator spec tables use the Unicode "SCRIPT SMALL L" liter
    // symbol (ℓ, U+2113), not the ASCII letter "l" every plugin's regex expects
    // (confirmed: "Net Total(Liter) 264 ℓ" — capacity extraction silently found
    // nothing because "\bl\b" never matches "ℓ"). Normalize it once, here.
    // Samsung's resolution spec rows use thousands-comma formatting ("3,840 x
    // 2,160") but the monitor plugin's resolution regex expects bare digits
    // ("3840\s*x\s*2160") — proven: the M8 32" UHD monitor (ls32bm801umxue)
    // has no "4K"/"UHD" wording in its own title, only in the spec value
    // "Resolution 3,840 x 2,160", so without this it silently extracted
    // NO_RES and collapsed onto an unrelated 32" FHD M5 monitor's identity
    // (a real cross-product collapse, not a duplicate). Strip the commas
    // between digit groups so the untouched plugin regex can match.
    const value = rawValue.replace(/ℓ/g, 'L').replace(/(\d),(\d)/g, '$1$2');
    // A "No" value means this FEATURE IS ABSENT — including the label text anyway
    // (e.g. "Wall Mount Bracket: No") introduces the word "mount" into the synthetic
    // text as if it were a real feature/accessory, which can trip an unrelated
    // category's accessory/wrong-device reject list (proven: this exact label made
    // the audio plugin treat a genuine Sound Tower speaker as a wall-mount
    // accessory listing and reject it). Skip both bare "No" and "0" negative flags.
    if (/^(no|0)$/i.test(value.trim())) continue;
    const l = label.toLowerCase();
    // "External Storage Support: MicroSD (Up to 2TB)" describes the OPTIONAL card
    // slot's maximum capacity, never the device's own built-in storage — but
    // tablet's extractStorage() checks for a bare "N TB" pattern FIRST and returns
    // immediately, so this label's "2TB" silently overrode a correctly-stated
    // "Storage (GB): 256GB" on the same page (proven: every Galaxy Tab S10 FE
    // variant, 128GB through 256GB alike, collapsed to the same wrong "2048"
    // storage value — a real cross-variant collision this fix prevents). Excluded
    // entirely: it contributes nothing a plugin's identity needs.
    if (/external storage support/.test(l)) continue;
    const numMatch = value.match(/^(\d+(?:\.\d+)?)/);
    const num = numMatch ? numMatch[1] : null;
    // Reformat into the phrasing each plugin's existing regex already expects.
    if (num && /storage/.test(l)) parts.push(`${num}GB`);
    else if (num && /^memory/.test(l)) parts.push(`${num}GB RAM`);
    else if (num && /screen size \(class\)/.test(l)) parts.push(`${num} inch`);
    else if (num && /battery capacity/.test(l)) parts.push(`${num}mAh`);
    else if (num && /weight \(g\)/.test(l)) parts.push(`${num}g`);
    // Resolution, refresh rate, panel type, BTU, capacity (L/kg), etc. are already
    // in a directly-matchable shape ("2560x1440", "60 Hz", "PLS", "18000 BTU/h",
    // "9 kg") — carry the raw value through untouched, plus the label for context.
    parts.push(`${label} ${value}`);
  }
  return parts.join(' | ');
}

// SCRIPT-LOCAL classification hints only — NOT a plugin/production change. This
// mission is read-only classification; the actual `scripts/tps-plugins/ac/parser.ts`
// is untouched. Samsung's own "Wall Mounted AC" URL-category phrasing doesn't
// contain the literal word "split" the live ac_type extractor requires (it does
// recognize "جداري"/wall-related Arabic, and "split", but not English "wall
// mount(ed)") — so for THIS classification pass only, a URL path signal is used
// to add the missing evidence word, exactly mirroring what a fuller Arabic title
// (which already says "جداري") would have given the real pipeline anyway.
function urlDerivedHints(url: string, title: string | null): string {
  const hints: string[] = [];
  if (/\/wall-mount\//i.test(url)) hints.push('split wall mounted');
  // Checked against title AND url — Samsung's washing-machine model code (the WT/WW
  // prefix evidence below) often appears only in the URL slug, never in the title
  // text itself (confirmed: "Buy High-Quality Washing Machines -12kg White" carries
  // no model code at all; "wt4200jm" is only in the URL).
  const t = `${(title ?? '').toLowerCase()} ${url.toLowerCase()}`;
  // "One Door Refrigerator" (Samsung's own phrasing) means the same physical
  // category the plugin calls "single_door" — confirmed on real titles
  // ("One Door Refrigerator Precise Cooling 394L Silver").
  if (/\bone[\s-]door\b/.test(t)) hints.push('single door');
  // "SBS" is Samsung's own abbreviation for Side-By-Side, used bare in some
  // titles ("SBS Refrigerator Silver 647L") with the full phrase never spelled out.
  if (/\bsbs\b/.test(t)) hints.push('side by side');
  // Samsung's own model-number PREFIX convention (official, documented manufacturer
  // scheme, not a guess): WT = top-load washer, WW = front-load washer. Used only
  // when the title/spec-table never states "front load"/"top load" outright.
  if (/\bwt\d{3,4}/i.test(t) && !/(front|top)[\s-]load/.test(t)) hints.push('top load');
  if (/\bww\d{2,3}/i.test(t) && !/(front|top)[\s-]load/.test(t)) hints.push('front load');
  return hints.join(' ');
}

// Terminal path segments that are always navigation/marketing sub-pages of a real
// product or family, never a distinct sellable item themselves — same list as
// close-samsung-denominator.ts's FAMILY_PAGE_TERMINALS, applied here too since a
// page can carry a leftover/templated `#modelCode` input (shared site chrome) even
// on a pure review/highlights sub-page, which would otherwise wrongly route it into
// "real product, needs resolution" instead of being excluded outright.
const FAMILY_OR_MARKETING_TERMINAL = /\/(reviews|highlights|design|connectivity|features|specs|specifications|gallery|accessories|technology|qled-technology)\/?$/i;

// Samsung's URL path segment IS the ground-truth category for samsung.com — a much
// stronger signal than letting a generic cross-category text heuristic (built for
// ambiguous retailer titles) freely claim any text. CRITICAL SAFETY FINDING during
// this pass: without a path guard, a dishwasher's spec table (electrical "60Hz" power
// frequency, an unrelated "24"-looking dimension) was wrongly claimed by the MONITOR
// plugin's loose hz+inch fallback, producing a monitor-shaped identity key for a
// dishwasher — a real cross-category false positive. Fix: when the URL path names a
// known category, ONLY that category's plugin may be tried (both its own detect()
// gate, exactly as live, AND the Bespoke-naming override below) — every other
// plugin is not attempted at all, so it can never claim this URL by coincidence.
const URL_PATH_CATEGORY: [RegExp, string][] = [
  [/\/air-conditioners\//i, 'air_conditioner'],
  [/\/monitors\//i, 'monitor'],
  [/\/tablets\//i, 'tablet'],
  [/\/smartphones\//i, 'mobile'],
  [/\/refrigerators\//i, 'refrigerator'],
  [/\/washers-and-dryers\//i, 'washing_machine'],
  [/\/watches\//i, 'smartwatch'],
  [/\/rings\//i, 'ring'],
  [/\/audio-devices\//i, 'audio'],
  [/\/(?:tvs|lifestyle-tvs)\//i, 'tv'],
  [/\/dishwashers\//i, 'dishwasher'],
  [/\/cooking-appliances\/(?:ranges|ovens)\//i, 'cooker'],
  [/\/microwave-ovens\//i, 'microwave'],
  [/\/vacuum-cleaners\//i, 'vacuum'],
];
// Known non-product / out-of-scope / unsupported URL-path segments — resolved
// WITHOUT any fetch or identity attempt, explicit reason codes, never guessed.
const KNOWN_NON_IDENTITY_PATH: [RegExp, string, string][] = [
  [/\/commercial-tvs\//i, 'B2B_OUT_OF_SCOPE', 'hotel/commercial TV line — B2B product, out of this mission\'s consumer-catalog scope'],
  [/\/cooking-appliances\/hoods\//i, 'UNSUPPORTED_CATEGORY_EXPLICIT', 'range hoods have no registered TPS category plugin anywhere on the platform (pre-existing, documented: "range hood remain ABSENT (n≈0)")'],
  [/\/display-accessories\//i, 'CONTAMINATION_NOT_PRODUCT', 'a monitor accessory (e.g. mounting tray), not a distinct sellable product'],
];

async function resolveOne(url: string): Promise<Resolved & { skipReason?: string; skipBucket?: string }> {
  const base: Resolved = { url, title: null, specCount: 0, syntheticText: '', computedIdentityKey: null, computedCategory: null, identityStatus: null };
  const nonIdentity = KNOWN_NON_IDENTITY_PATH.find(([re]) => re.test(url));
  if (nonIdentity) return { ...base, skipBucket: nonIdentity[1], skipReason: nonIdentity[2] };
  if (FAMILY_OR_MARKETING_TERMINAL.test(url)) {
    return { ...base, skipBucket: 'FAMILY_PAGE', skipReason: 'navigation/marketing sub-page terminal (reviews, highlights, design, etc.) — not a distinct sellable item, regardless of any leftover shared-template #modelCode markup' };
  }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!res.ok) return base;
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('title').first().text().replace(/\s*\|\s*Samsung.*$/i, '').trim() || null;
    const specs: Record<string, string> = {};
    $('.pdd32-product-spec__content-item').each((_i, el) => {
      const label = $(el).find('.pdd32-product-spec__content-item-title').text().trim();
      const value = $(el).find('.pdd32-product-spec__content-item-desc').text().trim();
      if (label && value) specs[label] = value;
    });
    const syntheticText = `${title ?? ''} ${specsToSyntheticText(specs)} ${urlDerivedHints(url, title)}`;

    let computedIdentityKey: string | null = null, computedCategory: string | null = null, identityStatus: string | null = null;
    const pathCat = URL_PATH_CATEGORY.find(([re]) => re.test(url))?.[1];
    if (pathCat) {
      // STRICT: the URL path names a known category — try ONLY that plugin (its own
      // detect() gate first, exactly as live; then, if detect() itself is the blocker,
      // the Bespoke/wall-mount-style override) so no other plugin can claim this URL.
      const def = CATEGORY_DEFS[pathCat];
      if (def.plugin.detect('', syntheticText)) {
        const norm = def.normalize('', syntheticText, 'Samsung', {});
        const identity = def.plugin.buildIdentityKey('Samsung', norm.payload, { model_number: norm.model_number });
        if (identity.key) { computedIdentityKey = identity.key; computedCategory = def.category; identityStatus = identity.status; }
      }
      if (!computedIdentityKey) {
        const norm = def.normalize('', syntheticText, 'Samsung', {});
        const identity = def.plugin.buildIdentityKey('Samsung', norm.payload, { model_number: norm.model_number });
        if (identity.key) { computedIdentityKey = identity.key; computedCategory = `${def.category} (via URL-path override, detect() gate bypassed)`; identityStatus = identity.status; }
      }
      // LOCAL-SCRIPT-ONLY fallback for this denominator-closure pass, not a change to
      // scripts/tps-plugins/audio/parser.ts: that plugin's extractModel() is a curated
      // list built for headphone/earbud brands (AirPods, Sony WH/WF, JBL, Bose, Galaxy
      // Buds, Soundcore, ...) and has no pattern for Samsung's OWN speaker lines (Sound
      // Tower "MX-STxxF", Soundbar "HW-Qxxxx"/"HW-Bxxxx", Wireless Speaker "HW-LSxxH") —
      // confirmed: every one of these titles/URLs carries a real, stable, official
      // Samsung model code, just not one the shared plugin's regex list recognizes. The
      // model code itself IS the correct identity (it already encodes line+generation,
      // audio's own contract), extracted from the URL slug (the most consistently
      // formatted source across these listings — several titles omit the code entirely,
      // e.g. "2.1ch Soundbar with Subwoofer (2025)").
      if (!computedIdentityKey && pathCat === 'audio') {
        // Not anchored to a slash immediately before the code — real slugs interpose
        // colour/other segments first (".../st40f-black-mx-st40f-sa/"), so the model
        // code + "-sa" suffix is searched for anywhere in the tail of the slug.
        const m = url.match(/([a-z]{2}-[a-z0-9]{4,8})-sa\/?$/i);
        // Detect() is checked against the TITLE ALONE here, not the full spec-table
        // dump — proven twice over that concatenating an entire spec table trips
        // audio's substring-based ACCESSORY_SIGNALS on completely unrelated universal
        // spec vocabulary ("Wall Mount Bracket: No" -> "mount"; "Stand-by Power
        // Consumption" -> "stand"), which a real, natural title never contains. The
        // title alone is exactly what a normal (working) detect() call would see.
        if (m && def.plugin.detect('', title ?? '')) {
          computedIdentityKey = `samsung|${m[1].toLowerCase()}`;
          computedCategory = 'audio (LOCAL SCRIPT ONLY: Samsung speaker model code from URL slug, not the shared plugin\'s model-recognition list)';
          identityStatus = 'valid';
        }
      }
    } else {
      // No known URL-path category for this URL (a genuinely ambiguous/unmapped path) —
      // fall back to the general-purpose all-categories loop.
      for (const def of Object.values(CATEGORY_DEFS)) {
        if (!def.plugin.detect('', syntheticText)) continue;
        const norm = def.normalize('', syntheticText, 'Samsung', {});
        const identity = def.plugin.buildIdentityKey('Samsung', norm.payload, { model_number: norm.model_number });
        if (identity.key) { computedIdentityKey = identity.key; computedCategory = `${def.category} (no URL-path mapping, general loop)`; identityStatus = identity.status; break; }
      }
    }
    return { url, title, specCount: Object.keys(specs).length, syntheticText: syntheticText.slice(0, 400), computedIdentityKey, computedCategory, identityStatus };
  } catch {
    return base;
  }
}

(async () => {
  const inputFile = process.argv[2];
  if (!inputFile) { console.error('Usage: resolve-residual-identities.ts <urls.json array file>'); process.exit(1); }
  const urls: string[] = JSON.parse(readFileSync(inputFile, 'utf8'));
  console.log(`Resolving ${urls.length} residual URLs via spec-table extraction (read-only, ~1.2s/URL pacing)...`);

  const results: Resolved[] = [];
  for (let i = 0; i < urls.length; i++) {
    const r = await resolveOne(urls[i]);
    results.push(r);
    console.log(`[${i + 1}/${urls.length}] specs=${r.specCount} -> ${r.computedIdentityKey ?? 'STILL UNRESOLVED'} — ${r.url.slice(-55)}`);
    await new Promise((res) => setTimeout(res, 1200));
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const keys = [...new Set(results.map((r) => r.computedIdentityKey).filter(Boolean))] as string[];
  const existingKeys = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await sb.from('canonical_products').select('tps_identity_key').in('tps_identity_key', keys.slice(i, i + 200));
    for (const row of data ?? []) existingKeys.add((row as { tps_identity_key: string }).tps_identity_key);
  }

  const resolved = results.filter((r) => r.computedIdentityKey);
  const stillUnresolved = results.filter((r) => !r.computedIdentityKey);
  const distinctResolvedIdentities = new Set(resolved.map((r) => r.computedIdentityKey));
  const newlyFound = [...distinctResolvedIdentities].filter((k) => !existingKeys.has(k as string));
  const alreadyCovered = [...distinctResolvedIdentities].filter((k) => existingKeys.has(k as string));

  console.log('\n=== SPEC-TABLE RESOLUTION SUMMARY ===');
  console.log('Total residual URLs processed:               ', results.length);
  console.log('Resolved to a real identity via spec table:  ', resolved.length, `(${distinctResolvedIdentities.size} distinct)`);
  console.log('  ...already covered by an existing canonical:', alreadyCovered.length);
  console.log('  ...genuinely new:                            ', newlyFound.length);
  console.log('STILL UNRESOLVED after spec-table extraction: ', stillUnresolved.length);
  if (stillUnresolved.length) {
    console.log('\nStill-unresolved URLs (need explicit reason coding, NOT silently dropped):');
    for (const r of stillUnresolved) console.log('  ', r.url, '| specs found:', r.specCount, '| title:', r.title);
  }

  writeFileSync(inputFile.replace(/\.json$/, '-spec-resolved.json'), JSON.stringify({ results, newlyFound, alreadyCovered, stillUnresolved }, null, 2));
  console.log('\nSaved to', inputFile.replace(/\.json$/, '-spec-resolved.json'));
})();
