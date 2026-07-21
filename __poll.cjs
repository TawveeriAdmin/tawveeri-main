require('dotenv').config({ path:'.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const BOUNDARY='2026-07-21T09:43:13Z';
(async()=>{
  console.log('Polling for new post-E4 Jarir run. boundary:', BOUNDARY, 'now:', new Date().toISOString());
  let lastId=0;
  for(let i=0;i<40;i++){
    const { data } = await sb.from('scraping_runs').select('*').eq('store_id',1).gte('started_at',BOUNDARY).order('id',{ascending:false}).limit(1);
    const run=data?.[0];
    if(run){ lastId=run.id; console.log(`[${new Date().toISOString()}] run ${run.id} status=${run.status} disc=${run.products_discovered} finished=${run.finished_at||'—'}`); if(run.status && ['success','failed','partial'].includes(run.status) && run.finished_at){ console.log('*** NEW E4 JARIR RUN COMPLETE — id',run.id,'***'); process.exit(0); } }
    else console.log(`[${new Date().toISOString()}] no post-boundary jarir run yet`);
    await sleep(30000);
  }
  console.log('poll ended');
})();
