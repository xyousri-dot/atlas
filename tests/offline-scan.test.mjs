import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as B from './browser.mjs';
process.env.ATLAS_SIMULATE_PREVIEW_AUTH='1';
before(B.start);after(B.stop);
test('Prepared test scanner survives network loss and reload, performs real OCR and never caches private routes',{skip:!process.env.ATLAS_HTML,timeout:180000},async()=>{
 const {page}=await B.open({beforeNavigate:async p=>{await p.setCookie({name:'atlas-preview-fixture',value:'1',domain:'127.0.0.1',path:'/'});await p.setRequestInterception(true);p.on('request',r=>new URL(r.url()).hostname==='127.0.0.1'||r.url().startsWith('data:')||r.url().startsWith('blob:')?r.continue():r.abort());}});
 try{
  await page.waitForFunction(()=>typeof atlasOfflineRequest==='function');
  await page.evaluate(()=>openNew());await page.click('#offlineScanPrepare');
  await page.waitForFunction(()=>document.getElementById('offlineScanStatus').textContent.includes('Prêt hors ligne'),{timeout:120000});
  const files=await page.evaluate(async()=>{const names=await caches.keys();const out=[];for(const name of names)for(const r of await(await caches.open(name)).keys())out.push(new URL(r.url).pathname);return out;});
  assert.ok(files.includes('/scan-assets/lang/eng.traineddata.gz'));assert.ok(files.includes('/scan-assets/core/tesseract-core-simd-lstm.wasm'));
  assert.ok(files.every(p=>!p.includes('/auth/')&&!p.includes('/rest/')&&!p.includes('/clients/')));
  await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof atlasOfflineRequest==='function');
  assert.equal(await page.evaluate(()=>navigator.onLine),false);
  const result=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1100;c.height=200;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='48px Arial';x.fillText('ATLAS TEST 123456',40,100);const start=performance.now();const text=await tesseractTekst(c,()=>{});return {text,ms:Math.round(performance.now()-start)};});
  assert.match(result.text,/ATLAS TEST 123456/);console.log('Offline OCR cold start ms:',result.ms);
  const truth=JSON.parse(readFileSync(new URL('./scanbank/waarheid.json',import.meta.url)))['pas-fra'];
  const confusion=await page.evaluate(t=>{const rows=[...t.mrz];rows[1]='I8ABI2345'+rows[1].slice(9);return atlasLocalMRZ(rows.join('\n'));},truth);assert.equal(confusion?.docNumber,truth.docNumber);
  const identity=await page.evaluate(async ({truth,font})=>{
   if(font){const face=new FontFace('OfflineFixtureMono','url(data:font/ttf;base64,'+font+')');await face.load();document.fonts.add(face);}
   const parse=atlasLocalMRZ;window.atlasLocalMRZ=t=>{window.offlineFixtureText=t;return parse(t);};
   const c=document.createElement('canvas');c.width=1400;c.height=750;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='28px Arial';x.fillText('SPECIMEN TEST — FICTION — PASSPORT',60,80);x.font='44px '+(font?'OfflineFixtureMono':'monospace');truth.mrz.forEach((line,i)=>x.fillText(line,60,550+70*i));
   const blob=await new Promise(r=>c.toBlob(r,'image/png'));const start=performance.now();const hit=await readMRZ(blob,{budget:3000});window.offlineFictiveFile=new File([blob],'SPECIMEN-TEST.png',{type:'image/png'});return {hit,ms:Math.round(performance.now()-start),fixtureText:offlineFixtureText};
  },{truth,font:process.env.ATLAS_FIXTURE_FONT?readFileSync(process.env.ATLAS_FIXTURE_FONT).toString('base64'):null});
  if(identity.hit?.docNumber!==truth.docNumber)console.log('FICTIVE fixture diagnostic only:',identity.fixtureText);
  assert.ok(identity.hit?.docNumber===truth.docNumber||identity.hit?.docNumber===''&&identity.hit.docShaky===true,'Wrong number must be rejected, not just labelled uncertain');assert.equal(identity.hit?.birthDate,truth.birth);assert.equal(identity.hit?.expiry,truth.docExpiry);assert.equal(identity.hit?.fullName,truth.name);console.log('Offline fictive passport:',identity.hit.docNumber?'correct':'number rejected; manual input required','ms:',identity.ms);
  const fullFlow=await page.evaluate(async()=>{openNew();const started=performance.now();await snelScan([offlineFictiveFile],'auto');return {name:SNELKLANT?.name,number:SNELKLANT?.docNumber,birth:SNELKLANT?.birth,reviewed:scanBevestigd(),ms:Math.round(performance.now()-started),mode:AIFOUT};});
  assert.equal(fullFlow.name,truth.name);assert.ok(fullFlow.number===truth.docNumber||fullFlow.number==='','A contradictory number must not reach the client form');assert.equal(fullFlow.birth,truth.birth);assert.equal(fullFlow.reviewed,false);assert.equal(fullFlow.mode,'offline');console.log('Offline whole fictive scan flow:',fullFlow.number?'correct':'number rejected; manual input required','ms:',fullFlow.ms);
  const status=await page.evaluate(()=>atlasOfflineRequest('atlas-offline-status'));assert.equal(status.ready,true);
  const suppressed=await page.evaluate(async()=>({ai:await aiLees([{}]),external:await ocrSpaceTekst(null)}));assert.equal(suppressed.ai,null);assert.equal(suppressed.external,'');
  await page.evaluate(()=>openNew());await page.screenshot({path:B.SCHERMEN+'offline-scan-ready.png'});
  // A partial/lost download must never claim readiness.
  await page.evaluate(async()=>{for(const name of await caches.keys())if(name.startsWith('atlas-test-scan-'))await(await caches.open(name)).delete(new URL('./scan-assets/worker.min.js',location.href));});
  assert.equal((await page.evaluate(()=>atlasOfflineRequest('atlas-offline-status'))).ready,false);
 }finally{await page.close();}
});
test('Build lists pinned files and has no private cache routes',()=>{
 const lock=JSON.parse(readFileSync(new URL('../scripts/scan-assets-lock.json',import.meta.url)));
 assert.ok(lock.length>=12);for(const a of lock){assert.ok(a.sha256&&a.bytes>0);assert.match(a.url,/^https:\/\/cdn.jsdelivr.net\/npm\//);}
 const sw=readFileSync(new URL('../offline-cache.js',import.meta.url),'utf8');assert.ok(sw.includes("req.method!=='GET'"));assert.ok(sw.includes('url.search'));assert.ok(sw.includes("fetch(req,{cache:'no-cache'})"));assert.ok(sw.indexOf("fetch(req,{cache:'no-cache'})")<sw.indexOf('cache.match(req)'),'Online must check for an update before using the offline copy');
});
