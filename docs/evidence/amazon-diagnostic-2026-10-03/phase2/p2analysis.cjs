const fs = require('fs'); const SP = process.argv[2];
const R = JSON.parse(fs.readFileSync(SP + '/p2a.json')).results;
const P = JSON.parse(fs.readFileSync(SP + '/p2prop.json'));
const out = {};
const pct = (a, b) => (100 * a / b).toFixed(1) + '%';
const clean = (s) => (s || '').replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim();
// ---------------- 7. Brand = Unknown ----------------
{
  const bu = R.brand_unknown; const n = bu.length;
  const KNOWN = new Set(['samsung','apple','lenovo','hp','dell','asus','acer','msi','lg','sony','tcl','hisense','xiaomi','huawei','honor','nikai','dansat','midea','gree','haier','panasonic','philips','bosch','beko','sharp','toshiba','hitachi','oppo','realme','vivo','oneplus','google','microsoft','jbl','anker','canon','epson','brother','nokia','motorola','tecno','infinix','black+decker','kenwood','moulinex','tefal','braun','dyson','bissell','supergeneral','impex','skyworth','aoc','benq','viewsonic','logitech','razer','jetech','ugreen','baseus','spigen','otterbox','belkin','sandisk','kingston','seagate','tp-link','netgear','d-link','gameon','ugine','aston','mando','falcon','classpro','geepas','olsenmark','krypton','nutribullet','ninja','instant','delonghi','nespresso','soundcore','redmi','poco','amazon','fire','kindle','echo','ring','blink','eufy','roborock','dreame','ecovacs','tineco','shark','vgr','kemei','remington','babyliss','oral-b','oralb','sonos','marshall','bose','sennheiser','beats','garmin','fitbit','fossil','casio','seiko','citizen','hp','zebronics','truva','gigabyte','nvidia','amd','intel','corsair','hyperx','steelseries','wacom','xp-pen','elgato','dji','gopro','insta360','nikon','fujifilm','olympus','gree','carrier','york','daikin','mitsubishi','fujitsu','general','samsung','whirlpool','indesit','ariston','electrolux','frigidaire','kelvinator','daewoo','candy','hoover','siemens','miele','smeg','kitchenaid','cuisinart','breville','russell hobbs','morphy richards','kenwood','sage','arzum','sokany','saachi','nikai','edison','geepas','emjoi','alsaif','al saif','rebune','lg']);
  const cls = (r) => {
    if (!r.has_pdp) return 'A_tile_only_never_PDP (brand hard-coded Unknown on tile path)';
    if (r.pdp_spec_brand && r.pdp_payload_brand && r.pdp_payload_brand !== 'Unknown') return 'B_PDP_brand_known_at_both_levels_but_storefront_row_never_updated';
    if (r.pdp_spec_brand) return 'C_PDP_spec_table_has_Brand_but_scraper_brand_list_missed_it';
    if (r.pdp_payload_brand && r.pdp_payload_brand !== 'Unknown') return 'D_PDP_payload_brand_known_storefront_not_updated';
    return 'E_PDP_seen_no_Brand_row_in_spec_table';
  };
  const c = {}; const ex = {}; for (const r of bu) { const k = cls(r); c[k] = (c[k] || 0) + 1; (ex[k] = ex[k] || []).length < 4 && ex[k].push((r.pdp_spec_brand || r.tile_payload_brand || '-') + ' <= ' + clean(r.name).slice(0, 70)); }
  let firstTok = 0; const tokEx = [];
  for (const r of bu) { const w = clean(r.name).toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').trim().split(/\s+/); if (KNOWN.has(w[0]) || KNOWN.has(w.slice(0, 2).join(' ')) || KNOWN.has(w[0] + w[1])) { firstTok++; if (tokEx.length < 6) tokEx.push(clean(r.name).slice(0, 50)); } }
  const byCat = {}; for (const r of bu) byCat[r.category] = (byCat[r.category] || 0) + 1;
  const specBrandRecoverable = bu.filter(r => r.pdp_spec_brand).length;
  out.brand_unknown = { n, classes: c, examples: ex, first_token_known_brand: firstTok, first_token_examples: tokEx, pdp_spec_brand_available: specBrandRecoverable, by_category: byCat };
  console.log('\n### 7. BRAND=Unknown n=' + n); for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) console.log(' ', k, v, pct(v, n), '|', ex[k].join(' | ').slice(0, 220));
  console.log('  recoverable: PDP spec Brand present', specBrandRecoverable, pct(specBrandRecoverable, n), '| title first token is a known brand', firstTok, pct(firstTok, n), '| e.g.', tokEx.join(' | '));
  console.log('  by category', JSON.stringify(Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 12)));
}
// ---------------- 8. Split ASINs ----------------
{
  const sa = R.split_asins; const g = {}; for (const r of sa) (g[r.asin] = g[r.asin] || []).push(r);
  const tax = {}; const exm = {}; const rows = [];
  for (const [a, rs] of Object.entries(g)) {
    const keys = [...new Set(rs.map(r => r.identity_key))]; const brands = new Set(keys.map(k => k.split('|')[0])); const cats = new Set(rs.map(r => r.category));
    const hasModel = keys.some(k => /\|MODEL:/.test(k)), allModel = keys.every(k => /\|MODEL:/.test(k));
    let t, detail = '';
    if (cats.size > 1) t = 'CATEGORY_MISMATCH';
    else if (brands.size > 1 && brands.has('google')) t = 'BRAND_TOKEN_platform(Google TV)';
    else if (brands.size > 1 && (brands.has('unknown') || brands.has('null'))) t = 'BRAND_unknown_vs_detected';
    else if (brands.size > 1) t = 'BRAND_TOKEN_other';
    else if (hasModel && !allModel) t = 'MODEL_vs_SPEC_keyspace(same ASIN, tile vs PDP or title variance)';
    else if (allModel) t = 'MODEL_token_variance(truncation/dimension string)';
    else { const parts = keys.map(k => k.split('|')); const diffs = []; for (let i = 0; i < Math.max(...parts.map(p => p.length)); i++) { const vals = new Set(parts.map(p => p[i])); if (vals.size > 1) diffs.push(i + ':' + [...vals].join('/')); } t = 'SPEC_FIELD_DIFF'; detail = diffs.join(';'); }
    tax[t] = (tax[t] || 0) + 1; (exm[t] = exm[t] || []).length < 5 && exm[t].push(a + ': ' + keys.join(' || ') + '  [' + clean(rs[0].name).slice(0, 60) + ']' + (detail ? ' {' + detail + '}' : ''));
    rows.push({ asin: a, taxonomy: t, detail, keys, categories: [...cats], name: clean(rs[0].name).slice(0, 120), sources: [...new Set(rs.map(r => r.source_method))], statuses: [...new Set(rs.map(r => r.status))] });
  }
  out.split_asins = { n: Object.keys(g).length, taxonomy: tax, examples: exm, rows };
  console.log('\n### 8. SPLIT ASINS n=' + Object.keys(g).length); for (const [k, v] of Object.entries(tax).sort((a, b) => b[1] - a[1])) { console.log(' ', k, v, pct(v, Object.keys(g).length)); for (const e of exm[k]) console.log('     ', e.slice(0, 220)); }
}
// ---------------- 9. Phones ----------------
{
  const pp = R.phones_amz_products; const npo = R.phones_npo_amz; const keys = R.phones_amz_keys;
  const npoNames = new Set(npo.map(x => x.raw_name)); let matched = 0; for (const p of pp) if (npoNames.has(p.name_en)) matched++;
  const un = pp.filter(p => !npoNames.has(p.name_en));
  const f = (re) => un.filter(p => re.test(p.name_en)).length;
  const brandsUn = un.reduce((m, p) => (m[p.brand] = (m[p.brand] || 0) + 1, m), {});
  const detectRejectSubstr = (name) => { const t = name.toLowerCase(); const acc = ['case', 'cover', 'stand', 'band', 'film', 'lens', 'cable', 'charger', 'holder', 'stylus']; const foreign = ['watch', 'buds', 'headphone', 'speaker', 'tablet', 'camera', 'oled', 'qled', 'uhd', 'monitor', 'laptop']; const a = acc.filter(s => t.includes(s)); const fo = foreign.filter(s => t.includes(s)); return { a, fo }; };
  const rej = { accessory_signal: 0, foreign_signal: 0, foreign_signal_only_amoled_or_camera: 0, none: 0 }; const rejEx = { accessory_signal: [], foreign_signal: [], none: [] };
  for (const p of un) { const r = detectRejectSubstr(p.name_en); if (r.a.length) { rej.accessory_signal++; rejEx.accessory_signal.length < 5 && rejEx.accessory_signal.push(r.a.join('/') + ' <= ' + p.name_en.slice(0, 70)); } else if (r.fo.length) { rej.foreign_signal++; if (r.fo.every(s => ['oled', 'camera', 'speaker'].includes(s))) rej.foreign_signal_only_amoled_or_camera++; rejEx.foreign_signal.length < 6 && rejEx.foreign_signal.push(r.fo.join('/') + ' <= ' + p.name_en.slice(0, 70)); } else { rej.none++; rejEx.none.length < 8 && rejEx.none.push((p.brand || '-') + ' <= ' + p.name_en.slice(0, 80)); } }
  const kd = {}; for (const x of npo) kd[x.detected_category] = (kd[x.detected_category] || 0) + 1;
  out.phones = { storefront_products: pp.length, storefront_brands: pp.reduce((m, p) => (m[p.brand] = (m[p.brand] || 0) + 1, m), {}), names_with_npo_row: matched, npo_rows: npo.length, npo_distinct_keys: new Set(npo.map(x => x.identity_key)).size, npo_valid_keys: new Set(npo.filter(x => x.identity_key_status === 'valid').map(x => x.identity_key)).size, npo_lowconf_rows: npo.filter(x => x.identity_key_status !== 'valid').length, detected_categories: kd, current_offer_keys: keys.length, renewed_in_offer_names: keys.filter(k => /renewed|refurbished/i.test(k.name)).length, unmatched: un.length, unmatched_brand_unknown: brandsUn['Unknown'] || 0, unmatched_by_brand: brandsUn, unmatched_patterns: { renewed: f(/renewed|refurb/i), accessory: f(/case|cover|protector|charger|cable|holder|glass/i), non_phone: f(/watch|tablet|ipad|earbud|buds|headphone|airpods/i), intl_or_ksa_version: f(/international|ksa version|middle east/i), feature_phone: f(/nokia|feature phone|keypad|basic phone|flip phone/i) }, detect_reject_simulation: rej, detect_reject_examples: rejEx, unmatched_sample: un.slice(0, 20).map(p => (p.brand || '-') + ' | ' + p.name_en.slice(0, 100)) };
  console.log('\n### 9. PHONES storefront', pp.length, '| names with an NPO mobile row', matched, '| NPO rows', npo.length, 'keys', out.phones.npo_distinct_keys, 'valid', out.phones.npo_valid_keys, '| current offers', keys.length);
  console.log('  unmatched', un.length, '| brand Unknown among unmatched', brandsUn['Unknown'] || 0, '| by brand', JSON.stringify(Object.entries(brandsUn).sort((a, b) => b[1] - a[1]).slice(0, 8)));
  console.log('  patterns', JSON.stringify(out.phones.unmatched_patterns), '| detect() substring simulation', JSON.stringify(rej));
  for (const k of Object.keys(rejEx)) console.log('   ', k, '::', rejEx[k].join(' | ').slice(0, 400));
}
// ---------------- 10. Laptops ----------------
{
  const la = R.laptops_amz; const le = R.laptops_ext_alm;
  const fam = (k) => k.split('|')[1];
  out.laptops = { amazon_sample: la.map(x => ({ key: x.identity_key, status: x.status, name: clean(x.name).slice(0, 100), asin: x.asin })), control_sample: le.map(x => ({ store: x.store_id, key: x.identity_key, name: clean(x.name).slice(0, 100) })), amazon_model_keys: la.filter(x => /MODEL:/.test(x.identity_key)).length, control_model_keys: le.filter(x => /MODEL:/.test(x.identity_key)).length, amazon_renewed: la.filter(x => /renewed|refurb/i.test(x.name)).length, amazon_no_family_or_screen: la.filter(x => /NO_FAMILY|NO_SCREEN/.test(x.identity_key)).length };
  console.log('\n### 10. LAPTOPS sample amazon', la.length, 'MODEL keys', out.laptops.amazon_model_keys, 'renewed', out.laptops.amazon_renewed, 'NO_FAMILY/NO_SCREEN', out.laptops.amazon_no_family_or_screen, '| control sample', le.length, 'MODEL keys', out.laptops.control_model_keys);
  for (const x of la.slice(0, 10)) console.log('   AMZ', x.identity_key.padEnd(42), '|', clean(x.name).slice(0, 90)); for (const x of le.slice(0, 10)) console.log('   CTL', String(x.store_id), x.identity_key.padEnd(40), '|', clean(x.name).slice(0, 90));
}
// ---------------- 14. Propagation cases ----------------
{
  const asinOf = (u) => { const m = (u || '').match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Za-z0-9]{10})(?:[/?&#]|$)/i); return m ? m[1].toUpperCase() : null; };
  const ps = {}; for (const r of P.product_stores) { const a = (r.external_id && /^[A-Z0-9]{10}$/i.test(r.external_id)) ? r.external_id.toUpperCase() : asinOf(r.product_url); if (!a) continue; if (!ps[a] || (r.updated_at || '') > (ps[a].updated_at || '')) ps[a] = r; }
  const rawAny = Object.fromEntries(P.latest_raw_any.map(r => [r.asin, r])); const rawPdp = Object.fromEntries(P.latest_raw_pdp.map(r => [r.asin, r]));
  const npoByName = {}; for (const n of P.npo) (npoByName[n.raw_name] = npoByName[n.raw_name] || []).push(n);
  const offersByAsin = {}; for (const o of P.all_offers) (offersByAsin[o.asin] = offersByAsin[o.asin] || []).push(o);
  const H = 168 * 36e5; const now = Date.parse(P.captured_at);
  const rows = []; const causes = {};
  for (const s of P.stale) {
    const a = s.asin; const p = ps[a]; const rp = rawPdp[a]; const ra = rawAny[a]; const offs = offersByAsin[a] || [];
    const sfFresh = p && p.updated_at && now - Date.parse(p.updated_at) <= H;
    const rec = { asin: a, category: s.category, stale_key: s.identity_key, stale_price: s.price, stale_observed: s.observed_at, reason: s.reason, storefront: p ? { id: p.id, price: p.current_price, availability: p.availability, updated_at: p.updated_at, last_checked_at: p.last_checked_at, last_scraped_at: p.last_scraped_at, scrape_status: p.scrape_status, misses: p.consecutive_misses } : null, latest_pdp_raw: rp ? { id: rp.id, at: rp.scraped_at, price: rp.price, avail: rp.avail, name: rp.raw_name.slice(0, 80) } : null, latest_any_raw: ra ? { id: ra.id, at: ra.scraped_at, method: ra.source_method, price: ra.price, avail: ra.avail, category: ra.category } : null, npo_for_latest_pdp_name: rp ? (npoByName[rp.raw_name] || []).slice(0, 4).map(n => ({ key: n.identity_key, cat: n.detected_category, status: n.identity_key_status, at: n.observed_at })) : [], offers_for_asin: offs.map(o => ({ key: o.identity_key, cat: o.category, status: o.status, price: o.price, at: o.observed_at, avail: o.avail })) };
    let cause;
    if (!p) cause = 'NO_STOREFRONT_ROW (unreachable by price_update lanes)';
    else if (!sfFresh) cause = 'STOREFRONT_ALSO_STALE (capacity/back-off)';
    else {
      const pdpFreshRaw = rp && now - Date.parse(rp.scraped_at) <= H;
      if (!pdpFreshRaw) cause = p.last_scraped_at && now - Date.parse(p.last_scraped_at) <= H ? 'STOREFRONT_WRITE_FRESH_BUT_NO_FRESH_PDP_RAW_OBSERVATION (write path without raw observation?)' : 'STOREFRONT_updated_at_FRESH_BUT_NOT_FROM_A_PDP_SCRAPE (updated_at advanced by another writer: discovery/quarantine/unavailable stamp)';
      else {
        const nrows = npoByName[rp.raw_name] || []; const freshN = nrows.filter(n => now - Date.parse(n.observed_at) <= H);
        if (!freshN.length) cause = 'FRESH_PDP_RAW_EXISTS_BUT_NO_NORMALIZED_ROW (normalize sweep did not pick it up / rejected)';
        else if (freshN.some(n => n.identity_key === s.identity_key)) cause = (s.reason === 'oos' || rp.avail === 'out_of_stock') ? 'FRESH_OBSERVATION_IS_OUT_OF_STOCK (correctly ineligible)' : (rp.price == null ? 'FRESH_OBSERVATION_HAS_NO_PRICE (unavailable product-only)' : 'FRESH_NORMALIZED_ROW_SAME_KEY_BUT_CURRENT_OFFER_NOT_ADVANCED (current-row selection / corroboratePass)');
        else if (freshN.some(n => n.identity_key_status !== 'valid')) cause = 'FRESH_PDP_NORMALIZED_TO_LOW_CONFIDENCE_KEY (identity downgrade on PDP title)';
        else cause = 'FRESH_PDP_NORMALIZED_TO_A_DIFFERENT_KEY (sibling key: ' + freshN[0].identity_key + ')';
      }
    }
    rec.cause = cause; causes[cause] = (causes[cause] || 0) + 1; rows.push(rec);
  }
  out.propagation = { n: rows.length, causes, rows };
  console.log('\n### 14. PROPAGATION n=' + rows.length); for (const [k, v] of Object.entries(causes).sort((a, b) => b[1] - a[1])) console.log(' ', v, k);
  for (const r of rows.filter(r => r.storefront && now - Date.parse(r.storefront.updated_at) <= H)) console.log('   ', r.asin, r.category, '|', r.cause.slice(0, 60), '| stale', r.stale_observed.slice(0, 10), r.stale_price, '| sf', r.storefront.price, r.storefront.availability, 'upd', (r.storefront.updated_at || '').slice(0, 10), 'scr', (r.storefront.last_scraped_at || '').slice(0, 10), '| pdp', r.latest_pdp_raw ? r.latest_pdp_raw.at.slice(0, 10) + ' ' + r.latest_pdp_raw.price + ' ' + r.latest_pdp_raw.avail : '-', '| npo', JSON.stringify(r.npo_for_latest_pdp_name.map(n => n.key + '@' + n.at.slice(5, 10))).slice(0, 120));
}
fs.writeFileSync(SP + '/p2analysis.json', JSON.stringify(out, null, 1));
