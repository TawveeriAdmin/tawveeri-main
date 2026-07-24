import { config } from "dotenv"; import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const c=new Client({connectionString:process.env.SUPABASE_DB_URL!,ssl:{rejectUnauthorized:false}});await c.connect();
  const baseProj=(await c.query(`select max(built_at) b from tps_product_projection`)).rows[0].b;
  const baseHbPid=(await c.query(`select pid from tps_scheduler_heartbeat where id=1`)).rows[0]?.pid;
  console.log(`baseline: proj_built=${baseProj} | hb_pid=${baseHbPid}. Target commit d5c0983.`);
  let dbOk=false, schedFresh=false, autoRef=false, badHttp=0;
  const deadline=Date.now()+30*60*1000;
  while(Date.now()<deadline){
    let diag:any={}; let code="?";
    try{const r=await fetch("https://tawveeri.com/api/debug/scheduler");code=String(r.status);diag=await r.json();}catch(e){}
    if(code!=="200")badHttp++;
    const hb=(await c.query(`select pid,round(extract(epoch from(now()-booted_at))) ago,last_refresh_status from tps_scheduler_heartbeat where id=1`)).rows[0];
    const proj=(await c.query(`select max(built_at) b from tps_product_projection`)).rows[0].b;
    const t=new Date().toISOString().slice(11,19);
    const commit=(diag.commit||"").slice(0,7);
    if(diag?.dbTest?.ok && !dbOk){dbOk=true;console.log(`[${t}] ✅ dbTest.ok=true (pooler reachable from Railway; commit ${commit})`);}
    if(hb && Number(hb.ago)<300 && hb.pid!==baseHbPid && !schedFresh){schedFresh=true;console.log(`[${t}] ✅ (1)(2) FRESH HEARTBEAT — pid ${hb.pid}, booted ${hb.ago}s ago`);}
    if(new Date(proj).getTime()>new Date(baseProj).getTime() && !autoRef){autoRef=true;console.log(`[${t}] ✅ (3) AUTO-REFRESH — projection rebuilt to ${proj}, refresh_status=${hb?.last_refresh_status}`);}
    if(schedFresh && autoRef){console.log(`[${t}] 🎉 AUTOMATION VERIFIED END-TO-END. site 5xx during window=${badHttp}.`);await c.end();process.exit(0);}
    console.log(`[${t}] commit=${commit} site=${code} dbTest=${diag?.dbTest?.ok?'ok':(diag?.dbTest?.error||'-').slice(0,40)} hb_pid=${hb?.pid} hb_ago=${hb?.ago}s auto_ref=${autoRef}`);
    await sleep(30000);
  }
  console.log(`TIMEOUT 30min. dbOk=${dbOk} schedFresh=${schedFresh} autoRef=${autoRef} 5xx=${badHttp}`);
  await c.end();
})().catch(e=>console.error("err",e instanceof Error?e.message:e));
