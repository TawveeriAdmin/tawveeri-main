const puppeteer = require('puppeteer');
const fs = require('fs');
const assert = require('assert/strict');
const base = process.env.HOME_BASE || 'http://localhost:3100';
const stage = process.env.HOME_STAGE || 'local';
const dir = 'docs/evidence/home-mission-discovery-2026-09-27';
(async () => {
  const browser = await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page = await browser.newPage();
    const events=[]; const errors=[];
    await page.setViewport({width:390,height:844});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('tw_test','1'));
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',req=>{if(req.url().endsWith('/api/events')) {const body=JSON.parse(req.postData()||'{}');if(['home_mission','home_share','go_click'].includes(body.event_type))events.push(body);}});
    const visit=async route=>{const r=await page.goto(base+route,{waitUntil:'networkidle2',timeout:90000});assert.equal(r.status(),200);};
    const click=async label=>{await page.waitForFunction(label=>[...document.querySelectorAll('button,a')].some(e=>e.textContent.trim()===label||e.getAttribute('aria-label')===label),{timeout:60000},label);await page.evaluate(label=>[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===label||e.getAttribute('aria-label')===label).click(),label);};
    await visit('/ar?test=1');
    await click('جهّز بيتك');
    await page.waitForFunction(()=>location.pathname.endsWith('/home-mission')&&new URLSearchParams(location.search).get('source')==='navigation');
    await visit('/ar?test=1');
    await click('ابدأ خطة بيتك');
    await page.waitForFunction(()=>location.pathname.endsWith('/home-mission')&&new URLSearchParams(location.search).get('source')==='homepage_card');
    await visit('/ar?test=1');
    await click('شوف مثال لخطة جاهزة');
    await page.waitForFunction(()=>location.pathname.endsWith('/home-mission/example'));
    await click('سوِّ خطة لبيتك');
    await page.waitForFunction(()=>document.body.innerText.includes('ابنِ الخطة'),{timeout:60000});
    const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('tw_home_mission_draft_v1')));
    assert.deepEqual(draft.draft.spaces.map(s=>s.area_m2),[16,24]);
    await page.reload({waitUntil:'networkidle2'});
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tw_home_mission_draft_v1')).draft.budget_total),15000);
    await click('ابنِ الخطة');
    await page.waitForFunction(()=>!!localStorage.getItem('tw_home_mission_v3'),{timeout:90000});
    const original=await page.evaluate(()=>localStorage.getItem('tw_home_mission_v3'));
    const parsed=JSON.parse(original);
    assert.equal(parsed.plan.understood.spaces.length,2);
    const picks=parsed.plan.legs.filter(l=>l.state==='ok'&&l.picked);
    const sum=picks.reduce((n,l)=>n+l.picked.unit_price,0);
    assert.ok(Math.abs(sum-parsed.plan.allocation.total_allocated)<0.1);
    await page.screenshot({path:`${dir}/${stage}-personal-mobile.png`,fullPage:true});
    await visit('/ar/home-mission/example?source=navigation&test=1');
    page.once('dialog',dialog=>dialog.dismiss());
    await click('سوِّ خطة لبيتك');
    assert.equal(await page.evaluate(()=>localStorage.getItem('tw_home_mission_v3')),original);
    await visit('/ar/home-mission?source=fridge_results&test=1');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tw_home_mission_v3')).plan.understood.budget_total),15000);
    // Share creates a snapshot and copies locally; no message is sent to anyone.
    await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedPlan=text;}}});});
    await click('شارك الخطة');
    await page.waitForFunction(()=>!!window.__copiedPlan,{timeout:90000});
    const sharedUrl=await page.evaluate(()=>window.__copiedPlan.match(/https?:\/\/\S+/)?.[0]);
    assert.ok(sharedUrl);
    const sharedPath=new URL(sharedUrl).pathname;
    await visit(sharedPath+'?test=1');
    assert.ok((await page.evaluate(()=>document.body.innerText)).includes('أعط رأيك'));
    await visit('/ar/home-mission?source=example&test=1');
    const exitHref = await page.$eval('a[href^="/go/"]', a=>a.getAttribute('href'));
    let exitUrl;
    await page.setRequestInterception(true);
    page.on('request',req=>{
      if(new URL(req.url()).pathname.startsWith('/go/')) { exitUrl=req.url(); req.respond({status:200,contentType:'text/html',body:'<p>Test intercepted retailer exit; no merchant visit.</p>'}); }
      else req.continue();
    });
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),page.click('a[href^="/go/"]')]);
    const expectedExit=new URL(exitHref,base), actualExit=new URL(exitUrl);
    assert.equal(actualExit.pathname,expectedExit.pathname);
    for(const [key,value] of expectedExit.searchParams)assert.equal(actualExit.searchParams.get(key),value);
    assert.ok(events.some(e=>e.event_type==='go_click'&&e.meta.entry_source==='example'));
    await visit('/ar/home-mission?test=1');
    await page.evaluate(()=>{localStorage.removeItem('tw_home_mission_v3');localStorage.removeItem('tw_home_mission_draft_v1');});
    await visit('/ar/home-mission?source=ac_results&test=1');
    const contextual=await page.evaluate(()=>JSON.parse(localStorage.getItem('tw_home_mission_draft_v1')).draft);
    assert.equal(contextual.budget_total,null);assert.equal(contextual.quantities.air_conditioner,1);
    // Use the public category links' actual query routes, not raw internal
    // canonical category names that the storefront filter enum does not support.
    for(const [query,source] of [['مكيف','ac_results'],['ثلاجة','fridge_results'],['غسالة','washer_results'],['ايفون',null]]) {
      const searchResponse = page.waitForResponse(r=>r.url().endsWith('/api/search')&&r.request().method()==='POST',{timeout:90000});
      await visit(`/ar/search?q=${encodeURIComponent(query)}&test=1`);
      await searchResponse;
      if(source) await page.waitForSelector(`[data-home-entry="${source}"]`,{timeout:90000});
      const entries=await page.$$eval('[data-home-entry]',nodes=>nodes.map(n=>n.dataset.homeEntry));
      if (JSON.stringify(entries)!==JSON.stringify(source?[source]:[])) {
        fs.writeFileSync(`${dir}/${stage}-category-failure.txt`,await page.evaluate(()=>document.body.innerText));
        await page.screenshot({path:`${dir}/${stage}-category-failure.png`,fullPage:true});
      }
      assert.deepEqual(entries,source?[source]:[]);
    }
    const steps=events.filter(e=>e.event_type==='home_mission').map(e=>e.meta.step);
    for(const step of ['example_view','started','reviewed','plan','share_click'])assert.ok(steps.includes(step),step);
    assert.ok(events.some(e=>e.event_type==='home_share'&&e.meta.step==='opened'&&e.source==='shared_link'));
    assert.ok(events.every(e=>!e.query_text));
    assert.deepEqual(errors,[]);
    fs.writeFileSync(`${dir}/${stage}-journey.json`,JSON.stringify({passed:true,picks:picks.length,total:sum,remaining:parsed.plan.allocation.remaining,steps,events,errors},null,2));
    console.log({passed:true,picks:picks.length,total:sum,events:events.length});
  } finally {await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
