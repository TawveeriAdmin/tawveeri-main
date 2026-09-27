const puppeteer=require('puppeteer'),fs=require('fs');
const dir='docs/evidence/home-mission-discovery-2026-09-27';
(async()=>{
  const browser=await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage();await page.setViewport({width:390,height:844});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('tw_test','1'));
    const responses=[];
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('response',async r=>{if(r.url().endsWith('/api/search')){const body=await r.json().catch(()=>null);responses.push({status:r.status(),request:JSON.parse(r.request().postData()||'{}'),response:{error:body?.error,resolvedCategory:body?.resolvedCategory,total:body?.total,products:body?.products?.length}});}});
    const results=[];
    for(const category of ['مكيف','ثلاجة','غسالة','ايفون']){
      await page.goto(`https://tawveeri.com/ar/search?q=${encodeURIComponent(category)}&test=1`,{waitUntil:'networkidle2',timeout:90000});
      await page.waitForNetworkIdle({idleTime:1000,concurrency:0,timeout:60000}).catch(()=>{});
      results.push(await page.evaluate(()=>({url:location.href,text:document.body.innerText,entries:[...document.querySelectorAll('[data-home-entry]')].map(n=>n.dataset.homeEntry),cache:sessionStorage.getItem('search_results_cache')?JSON.parse(sessionStorage.getItem('search_results_cache')).category:null})));
      await page.screenshot({path:`${dir}/probe-${category}.png`,fullPage:true});
    }
    fs.writeFileSync(`${dir}/public-category-probe.json`,JSON.stringify({responses,results,errors},null,2));
    console.log(JSON.stringify({responses,results:results.map(({text,...r})=>r),errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
