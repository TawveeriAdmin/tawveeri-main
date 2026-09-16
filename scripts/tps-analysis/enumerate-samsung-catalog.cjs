/** Read-only, independent Saudi PLP denominator. Never counts a family as a SKU.
 * Usage: node scripts/tps-analysis/enumerate-samsung-catalog.cjs <output.json>
 * PDP/sitemap reconciliation is separate: a zero-result PLP is not proof of absence.
 */
const fs = require('fs');
const cheerio = require('cheerio');

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response;
}

async function enumerate(output) {
  const evidence = { startedAt: new Date().toISOString(), surfaces: [], errors: [] };
  for (const site of ['sa_en', 'sa']) {
    const home = cheerio.load(await (await get(`https://www.samsung.com/${site}/`)).text());
    const paths = [...new Set([...home('a[href]').map((_, el) => home(el).attr('href')?.split('?')[0])
      .get().filter(path => path.startsWith(`/${site}/`) && /\/all-/.test(path)),
      `/${site}/cooking-appliances/all-cooking-appliances/`])].sort();
    for (const path of paths) {
      const surface = { site, path, type: null, pages: [], families: [] };
      try {
        const page = cheerio.load(await (await get(`https://www.samsung.com${path}`)).text());
        surface.type = page('#pfCategoryTypeCode').val();
        if (!/^\d{8}$/.test(surface.type || '')) throw new Error('Missing public finder category');
        const familyIds = new Set();
        let complete = false;
        for (let start = 1; start < 10000;) {
          const query = new URLSearchParams({ type: surface.type, siteCode: site, start: String(start),
            num: '12', sort: 'newest', onlyFilterInfoYN: 'N', keySummaryYN: 'Y' });
          const url = `https://searchapi.samsung.com/v6/front/b2c/product/finder/global?${query}`;
          const json = await (await get(url)).json();
          const data = json.response?.resultData;
          if (!data?.common || !Array.isArray(data.productList)) throw new Error('Invalid finder response');
          const total = Number(data.common.totalRecord), end = Number(data.common.toRecord);
          surface.pages.push({ url, observedAt: new Date().toISOString(), common: data.common });
          for (const family of data.productList) {
            if (familyIds.has(family.familyId)) throw new Error(`Repeated family ${family.familyId}`);
            familyIds.add(family.familyId);
            if (Number(family.modelCount) !== family.modelList?.length) throw new Error(`Incomplete variants ${family.familyId}`);
            surface.families.push(family);
          }
          if (Number.isFinite(total) && end >= total) { complete = true; break; }
          if (!Number.isFinite(end) || end < start || !data.productList.length) throw new Error('Pagination stalled');
          start = end + 1;
        }
        if (!complete) throw new Error('Pagination bound reached');
        surface.complete = true;
      } catch (error) {
        surface.complete = false;
        evidence.errors.push({ site, path, error: error.message });
      }
      evidence.surfaces.push(surface);
      evidence.updatedAt = new Date().toISOString();
      fs.writeFileSync(output, JSON.stringify(evidence));
      console.log(site, path, surface.families.length, surface.complete);
    }
  }
  return evidence;
}

if (require.main === module) enumerate(process.argv[2] || 'scratchpad/samsung-recovery-finder-universe.json')
  .then(result => { if (result.errors.length) process.exitCode = 1; })
  .catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { enumerate };
