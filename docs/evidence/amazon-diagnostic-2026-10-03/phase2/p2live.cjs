// READ-ONLY live inspection of amazon.sa product pages: one GET per ASIN, 6 s apart, parse identifiers.
const fs = require('fs'); const cheerio = require('cheerio');
const SP = process.argv[2];
const sample = JSON.parse(fs.readFileSync(SP + '/p2a.json')).results.live_sample;
const extra = [{ category: 'mobile', asin: 'B0CHXS73N7', identity_key: 'apple|iPhone|15|Standard|128', stores: 4, name: 'iPhone 15 128 (phase-1 B case)' }];
const list = [...sample, ...extra].filter((v, i, a) => a.findIndex(x => x.asin === v.asin) === i);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clean = (s) => (s || '').replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim();
(async () => {
  const out = [];
  for (const it of list) {
    const rec = { ...it, url: `https://www.amazon.sa/-/en/dp/${it.asin}` };
    try {
      const r = await fetch(rec.url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9,ar;q=0.8', accept: 'text/html,application/xhtml+xml' }, redirect: 'follow' });
      rec.status = r.status; const html = await r.text(); rec.bytes = html.length;
      const $ = cheerio.load(html);
      rec.title = clean($('#productTitle').text());
      rec.captcha = /validateCaptcha|api-services-support@amazon\.com|Enter the characters you see below/i.test(html);
      rec.byline = clean($('#bylineInfo').text());
      rec.price = clean($('#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-price .a-offscreen').first().text());
      rec.list_price = clean($('#corePriceDisplay_desktop_feature_div .a-price.a-text-price .a-offscreen, #listPrice').first().text());
      rec.availability_raw = $('#availability').text(); rec.availability = clean(rec.availability_raw);
      rec.availability_has_newline = /\n/.test(rec.availability_raw.trim()); rec.availability_raw_len = rec.availability_raw.length;
      rec.buybox_unavailable_raw = /currently unavailable/i.test($('#desktop_buybox, #buybox').first().text());
      rec.outOfStock_el = $('#outOfStock').length > 0; rec.add_to_cart = $('#add-to-cart-button').length > 0;
      rec.seller = clean($('#sellerProfileTriggerId, #merchant-info').first().text());
      // identifier tables
      const specs = {};
      $('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, #productDetails_techSpec_section_2 tr').each((_, tr) => { const k = clean($(tr).find('th').text()); const v = clean($(tr).find('td').text()); if (k) specs[k] = v; });
      $('#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li').each((_, li) => { const t = clean($(li).text()); const m = t.match(/^(.+?)\s*:\s*(.+)$/); if (m) specs[m[1]] = m[2]; });
      $('#productOverview_feature_div tr').each((_, tr) => { const k = clean($(tr).find('td').first().text()); const v = clean($(tr).find('td').last().text()); if (k && !(k in specs)) specs['overview:' + k] = v; });
      rec.specs = specs;
      const pick = (...names) => { for (const n of names) { const k = Object.keys(specs).find(x => x.toLowerCase().replace(/[^a-z]/g, '') === n); if (k) return specs[k]; } return null; };
      rec.id_item_model_number = pick('itemmodelnumber', 'modelnumber'); rec.id_model_name = pick('modelname', 'overviewmodelname'); rec.id_manufacturer = pick('manufacturer'); rec.id_part_number = pick('partnumber', 'manufacturerpartnumber'); rec.id_brand = pick('brand', 'overviewbrand'); rec.id_asin = pick('asin'); rec.id_series = pick('series'); rec.id_colour = pick('colour', 'color', 'overviewcolour'); rec.id_capacity = pick('capacity', 'memorystoragecapacity', 'overviewmemorystoragecapacity');
      // JSON-LD / embedded identifiers
      const ld = []; $('script[type="application/ld+json"]').each((_, s) => { try { ld.push(JSON.parse($(s).html())); } catch { ld.push('unparsable'); } });
      rec.jsonld_count = ld.length; rec.jsonld_types = ld.map(x => x && x['@type']).filter(Boolean);
      rec.gtin_in_html = (html.match(/"(gtin|ean|upc|gtin13|gtin14)"\s*:\s*"([^"]+)"/i) || [])[0] || null;
      rec.twister = /twister|variationValues|dimensionValuesDisplayData/.test(html) ? 'variation_data_present' : 'none';
      const dims = html.match(/"dimensionsDisplay"\s*:\s*(\[[^\]]*\])/); rec.variation_dimensions = dims ? dims[1].slice(0, 120) : null;
      rec.parent_asin = (html.match(/"parentAsin"\s*:\s*"([A-Z0-9]{10})"/) || [])[1] || (html.match(/parent_asin["']?\s*[:=]\s*["']([A-Z0-9]{10})/) || [])[1] || null;
    } catch (e) { rec.error = e.message; }
    out.push(rec); fs.writeFileSync(SP + '/p2live.json', JSON.stringify(out, null, 1));
    console.log(rec.category, rec.asin, 'status', rec.status, rec.captcha ? 'CAPTCHA' : '', '| brand', rec.id_brand, '| model#', rec.id_item_model_number, '| model name', rec.id_model_name, '| part', rec.id_part_number, '| avail', JSON.stringify(rec.availability), 'nl', rec.availability_has_newline, '| price', rec.price, '| twister', rec.twister, '| parent', rec.parent_asin);
    await sleep(6000);
  }
})();
