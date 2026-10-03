const fs=require('fs');const R=JSON.parse(fs.readFileSync(process.argv[2]+'/p2a.json')).results;
const pp=R.phones_amz_products,npo=R.phones_npo_amz;const names=new Set(npo.map(x=>x.raw_name));
const m=pp.filter(p=>names.has(p.name_en)),u=pp.filter(p=>!names.has(p.name_en));
const has=(arr,re)=>arr.filter(p=>re.test(p.name_en)).length;
for(const [lbl,re] of [['camera',/camera/i],['amoled/oled',/oled/i],['speaker',/speaker/i],['stand',/stand/i],['watch',/watch/i],['renewed',/renewed|refurb/i],['brand Unknown',null]]){console.log(lbl.padEnd(14),'matched',re?has(m,re):m.filter(p=>p.brand==='Unknown').length,'/',m.length,'| unmatched',re?has(u,re):u.filter(p=>p.brand==='Unknown').length,'/',u.length)}
console.log('matched sample:');for(const p of m.slice(0,8))console.log('  ',p.brand,'|',p.name_en.slice(0,100));
// unmatched, brand known, no accessory words, phone-like: the "should have matched" set
const core=u.filter(p=>p.brand!=='Unknown'&&!/case|cover|protector|charger|cable|holder|glass|film/i.test(p.name_en));console.log('unmatched with known brand & not accessory:',core.length);for(const p of core.slice(0,14))console.log('  ',p.brand,'|',p.name_en.slice(0,110));
