require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
(async () => {
  const file = process.argv[2];
  const sql = fs.readFileSync(file, 'utf8');
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const res = await c.query(sql);
  const arr = Array.isArray(res) ? res : [res];
  arr.forEach((r,i)=>{ if(r && r.command && r.rowCount!=null) console.error(`stmt ${i}: ${r.command} ${r.rowCount}`); });
  console.error('migration applied:', file);
  await c.end();
})().catch(e=>{console.error('ERR', e.message);process.exit(1)});
