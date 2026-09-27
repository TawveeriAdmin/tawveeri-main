const puppeteer = require('puppeteer');
const fs = require('fs');
const base = process.env.HOME_BASE || 'https://tawveeri.com';
const stage = process.env.HOME_STAGE || 'before';
const dir = 'docs/evidence/home-mission-discovery-2026-09-27';
(async () => {
  const browser = await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--lang=ar']});
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => localStorage.setItem('tw_test','1'));
    const results=[];
    for (const [name,route] of [['home','/ar?test=1'],['mission','/ar/home-mission?test=1'],...(stage==='before'?[]:[['example','/ar/home-mission/example?test=1&source=homepage_card']])]) {
      await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
      const response = await page.goto(base+route,{waitUntil:'networkidle2',timeout:90000});
      if(name==='example') await page.waitForFunction(()=>document.body.innerText.includes('سوِّ خطة لبيتك')||document.body.innerText.includes('تعذر'),{timeout:60000});
      await page.screenshot({path:`${dir}/${stage}-${name}-desktop.png`,fullPage:true});
      await page.setViewport({width:390,height:844,deviceScaleFactor:1});
      await page.screenshot({path:`${dir}/${stage}-${name}-mobile.png`,fullPage:true});
      results.push({name,status:response.status(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),text:await page.evaluate(()=>document.body.innerText),timing:await page.evaluate(()=>({dom:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,bytes:performance.getEntriesByType('resource').filter(r=>r.name.includes('/_next/static/')&&r.name.endsWith('.js')).reduce((sum,r)=>sum+r.encodedBodySize,0)}))});
    }
    fs.writeFileSync(`${dir}/${stage}-browser.json`,JSON.stringify(results,null,2));
    console.log(results.map(({text,...r})=>r));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
