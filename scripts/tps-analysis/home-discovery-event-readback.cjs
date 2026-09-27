// Read-only verification of this task's anonymous QA sessions. No auth session
// creation, user/account queries, writes, messages or credentials in output.
require('dotenv').config({path:'.env.local',quiet:true});
const {createClient}=require('@supabase/supabase-js');
const fs=require('fs');
const dir='docs/evidence/home-mission-discovery-2026-09-27';
(async()=>{
  const recorded=JSON.parse(fs.readFileSync(`${dir}/live-journey.json`,'utf8'));
  const sessions=[...new Set(recorded.events.map(e=>e.session_id))];
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const {data,error}=await db.from('usage_events').select('event_type,source,meta,is_test,query_text')
    .in('session_id',sessions).in('event_type',['home_mission','home_share','go_click']).limit(200);
  if(error)throw Error('QA event readback failed: '+error.code);
  if(!data?.length)throw Error('No persisted QA events');
  if(data.some(e=>!e.is_test||e.query_text))throw Error('QA isolation or privacy assertion failed');
  const counts={};
  for(const row of data){const key=[row.event_type,row.source,row.meta?.mode,row.meta?.step].join('|');counts[key]=(counts[key]||0)+1;}
  const expected=recorded.events.length;
  if(data.length!==expected)throw Error(`Persisted ${data.length} of ${expected} emitted QA events`);
  const result={passed:true,emitted:expected,persisted:data.length,all_test:true,no_free_text:true,counts};
  fs.writeFileSync(`${dir}/live-event-readback.json`,JSON.stringify(result,null,2));
  console.log(result);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
