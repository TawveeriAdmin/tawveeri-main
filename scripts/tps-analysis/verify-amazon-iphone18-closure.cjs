/* One existing comparison only. Read-only; resolves /go without click events. */
require('dotenv').config({path:'.env.local',quiet:true});
const fs=require('fs');
const puppeteer=require('puppeteer');
const {createClient}=require('@supabase/supabase-js');
const key='apple|iPhone|18|Pro|256';
const phase=process.argv.find(a=>a.startsWith('--phase='))?.slice(8)||'before-deploy';
(async()=>{
 const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const response=await fetch(`https://tawveeri.com/api/compare?key=${encodeURIComponent(key)}&locale=ar`);
 const comparison=await response.json();
 const offers=comparison.offers||[];
 const amazon=offers.find(o=>o.store_slug==='amazon');
 const almanea=offers.find(o=>o.store_slug==='almanea');
 if(response.status!==200||!amazon||!almanea||Number(amazon.price)!==5699)throw new Error('Expected live comparison not present');
 const result={at:new Date().toISOString(),phase,key,httpStatus:response.status,comparisonUrl:`https://tawveeri.com/ar/compare/${encodeURIComponent(key)}`,
  offers:offers.map(o=>({store:o.store_slug,price:o.price,availability:o.availability,url:o.product_url})),
  basePriceWithoutTradeIn:true};
 const id=amazon.product_url?.match(/\/go\/([0-9a-f-]{36})/i)?.[1];
 if(!id)throw new Error('Missing observation-backed Amazon exit');
 const npo=await sb.from('normalized_product_observations').select('normalized_payload').eq('id',id).single();
 if(npo.error)throw npo.error;
 result.destination=npo.data.normalized_payload._url;
 if(new URL(result.destination).hostname!=='www.amazon.sa'||!new URL(result.destination).pathname.includes('/dp/B0HJ9V43LX'))throw new Error('Wrong destination ASIN');
 const search=await fetch('https://tawveeri.com/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'iPhone 18 Pro 256',pageSize:20})});
 const searchData=await search.json();
 const card=(searchData.products||[]).find(p=>p.tps_identity_key===key);
 result.search={status:search.status,key:card?.tps_identity_key,stores:(card?.stores||[]).map(o=>({store:o.store,price:o.current_price}))};
 if(!result.search.stores.some(o=>o.store==='amazon'&&Number(o.price)===5699)||!result.search.stores.some(o=>o.store==='almanea'))throw new Error('Search does not show both merchants');
 const browser=await puppeteer.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.setViewport({width:1366,height:1000});
  await page.goto(result.comparisonUrl,{waitUntil:'networkidle2',timeout:60000});
  result.rendered=await page.evaluate(()=>({text:document.body.innerText,links:[...document.querySelectorAll('a[href^="/go/"]')].map(a=>a.getAttribute('href'))}));
  if(!/أمازون|Amazon/.test(result.rendered.text)||!/المنيع|Almanea/.test(result.rendered.text)||!/256/.test(result.rendered.text))throw new Error('Both stores not rendered');
  await page.screenshot({path:`scratchpad/amazon-iphone18-comparison-${phase}.png`,fullPage:true});
  const merchant=await page.goto(result.destination,{waitUntil:'domcontentloaded',timeout:60000});
  result.merchant={status:merchant.status(),url:page.url(),...await page.evaluate(()=>({title:document.querySelector('#productTitle')?.textContent?.trim(),asin:document.querySelector('input[name="ASIN"]')?.value}))};
  if(result.merchant.asin!=='B0HJ9V43LX'||!/18 Pro 256\s*GB/.test(result.merchant.title||''))throw new Error('Merchant landing variant mismatch');
  result.passed=true;
 }finally{await browser.close();fs.writeFileSync(`scratchpad/amazon-iphone18-live-${phase}.json`,JSON.stringify(result,null,2));}
 console.log(JSON.stringify({passed:result.passed,url:result.comparisonUrl,offers:result.offers,merchant:result.merchant}));
})().catch(e=>{console.error(e);process.exitCode=1;});
