import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as B from './browser.mjs';
import {TEST_PROJECT} from '../scripts/test-environment.mjs';
import {reminderSummary,reminderItems} from '../supabase/functions/_shared/reminders.mjs';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const appSource=readFileSync(process.env.ATLAS_HTML||new URL('../index.html',import.meta.url),'utf8');
const sessionKey=appSource.match(/SBSKEY="([^"]+)"/)?.[1];
async function notificationPage(language='fr',pad='/',scanMock=null,extraData={}){
  const data=B.testgegevens();data['vehicles/c1'].maintenance=[{id:'m1',label:'Courroie test',dueKm:120000}];data['rentals/cancelled']={...data['rentals/r1'],cancelled:true};
  Object.assign(data,extraData);
  return B.open({taal:language,gegevens:data,pad,beforeNavigate:async page=>{
    await page.evaluateOnNewDocument(key=>{localStorage.setItem(key,JSON.stringify({access_token:'FAKE-TEST-TOKEN',user:{id:'test-owner'}}));},sessionKey);
    await page.setRequestInterception(true);
    page.on('request',req=>{
      if(req.url().includes('.supabase.co/')){
        if(req.url().includes('/functions/v1/atlas-push')&&req.method()==='POST'&&JSON.parse(req.postData()||'{}').action==='examples')return req.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify({accepted:3,duplicate:0,failed:0})});
        if(req.url().includes('/functions/v1/atlas-scan')&&scanMock){if(req.method()==='POST'){scanMock.calls++;scanMock.sent=JSON.parse(req.postData());}return req.respond({status:req.method()==='OPTIONS'?200:scanMock.status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(scanMock.body)});}
        const json=req.url().includes('/rest/v1/atlas')?Object.entries(data).map(([path,value])=>({path,data:value})):req.url().includes('/functions/v1/atlas-push')?{items:[{kind:'documents',label:'Dacia Logan',doc:'inspectionUntil',url:'./#atlas=vehicle&id=c1&section=documents&doc=inspectionUntil'}]}:{};
        return req.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(json)});
      }return req.continue();
    });
  }});
}
for(const language of ['fr','nl','ar'])test('Notification destinations and cold startup: '+language,async()=>{
  const {page,fouten}=await notificationPage(language,'/#atlas=vehicle&id=c1&section=documents&doc=inspectionUntil&owner=test-owner');
  try{
    await page.waitForFunction(()=>view==='vCar');
    assert.equal(await page.$eval('#cwModel',e=>e.value),'Dacia Logan');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('input')?.id||document.activeElement.id),'cwInsp');
    for(const [section,id,screen] of [['maintenance','c1','vCar'],['departures','r2','vCard'],['late','r3','vCard'],['dossiers','r2','vNew'],['balances','r3','vDone'],['deposits','r4','vDone']]){
      await page.evaluate(async({section,id})=>{location.hash='atlas='+(id==='c1'?'vehicle':'rental')+'&id='+id+'&section='+section;await openNotificationTarget();},{section,id});
      await page.waitForFunction(v=>view===v,{timeout:5000},screen);
    }
    await page.evaluate(()=>{location.hash='atlas=alerts';});await page.waitForSelector('#notificationAlerts button:nth-of-type(2)');
    await page.click('#notificationAlerts button:nth-of-type(2)');await page.waitForFunction(()=>view==='vCar');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('input')?.id||document.activeElement.id),'cwInsp');
    assert.deepEqual(fouten,[]);
  }finally{await page.close();}
});
test('Notification errors stay visible; retry, deletion, cancelled rental and login',async()=>{
  const {page,fouten}=await notificationPage();
  try{
    await page.evaluate(()=>{window.notificationOriginalRead=sbHaal;sbHaal=async()=>false;location.hash='atlas=vehicle&id=c1&section=documents';});
    await page.waitForSelector('#notificationProblem');assert.equal(await page.$$eval('#notificationProblem button',x=>x.length),2);
    await page.evaluate(()=>{sbHaal=window.notificationOriginalRead;});await page.click('#notificationProblem button');await page.waitForFunction(()=>view==='vCar');
    assert.equal(await page.$('#notificationProblem'),null);
    for(const hash of ['atlas=vehicle&id=deleted','atlas=rental&id=cancelled']){
      await page.evaluate(hash=>{location.hash=hash;},hash);await page.waitForSelector('#notificationProblem');assert.match(await page.$eval('#notificationProblem',e=>e.textContent),/supprimé/);
    }
    await page.evaluate(()=>{sbAfmelden();location.hash='atlas=rental&id=r3&section=balances';});await page.waitForFunction(()=>view==='vSet');
    assert.ok(await page.evaluate(()=>location.hash.includes('id=r3')));
    await page.evaluate(()=>{SBSES={access_token:'FAKE-TEST-TOKEN',user:{id:'test-owner'}};naAanmelden();});await page.waitForFunction(()=>view==='vDone');
    await page.evaluate(()=>{location.hash='atlas=vehicle&id=c1&owner=someone-else';});await page.waitForFunction(()=>view==='vSet');
    assert.deepEqual(fouten,[]);
  }finally{await page.close();}
});
test('Closed app restores destination saved by background worker, even when launched at home',async()=>{
  let {page}=await notificationPage();
  await page.waitForFunction(()=>NOTIFICATION_READY&&!NOTIFICATION_RECOVERING,{timeout:12000});
  await page.evaluate(async()=>{
    await navigator.serviceWorker.register('./push-sw.js');await navigator.serviceWorker.ready;
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('atlas-push-routing',1);request.onupgradeneeded=()=>request.result.createObjectStore('targets');request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{const db=request.result,tx=db.transaction('targets','readwrite');tx.objectStore('targets').put({url:location.origin+'/#atlas=vehicle&id=c1&section=documents&doc=vignetteUntil&owner=test-owner',at:Date.now()},'pending');tx.oncomplete=()=>{db.close();resolve();};};
    });
  });
  await page.close();
  const reopened=await notificationPage();page=reopened.page;
  try{
    await page.waitForFunction(()=>view==='vCar',{timeout:12000});
    assert.equal(await page.$eval('#cwModel',e=>e.value),'Dacia Logan');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('input')?.id||document.activeElement.id),'cwVig');
    assert.deepEqual(reopened.fouten,[]);
  }finally{await page.close();}
});
before(B.start);after(B.stop);
test('Phone example control is test-only and reports acceptance without claiming receipt',async()=>{
 const {page,fouten}=await notificationPage('nl');try{
  await page.evaluate(()=>{view='vSet';render();mountPhoneSettings();});
  if(!process.env.ATLAS_HTML){assert.equal(await page.$('#phoneExamples'),null);return;}
  let calls=0;page.on('request',request=>{if(request.url().includes('/functions/v1/atlas-push')&&request.method()==='POST'&&JSON.parse(request.postData()||'{}').action==='examples')calls++;});
  await page.click('#phoneExamples');await page.waitForFunction(()=>document.querySelector('#phoneExampleStatus').textContent.includes('geaccepteerd: 3'));assert.match(await page.$eval('#phoneExampleStatus',e=>e.textContent),/Ontvangst moet je nog bevestigen/);assert.equal(calls,1);assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Retry after interrupted repair save reuses the same expense and history ids',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page}=await B.open({taal:'fr',gegevens:B.testgegevens()});try{
  await page.waitForFunction(()=>typeof openMaintenanceWarranty==='function');await page.evaluate(()=>openCar(car('c1')));await page.click('#careDone');await page.type('#warrantyAdd input[aria-label="Pièce ou réparation"]','RETRY TEST');await page.click('#replacementInvoice summary');await page.type('#warrantyAdd input[aria-label="Prix payé (DH, facultatif)"]','500');
  await page.evaluate(()=>{window.savedSet=S.set;window.failVehicleOnce=true;S.set=async(path,value)=>{if(path.startsWith('vehicles/')&&window.failVehicleOnce){window.failVehicleOnce=false;throw Error('TEST interrupted write');}return window.savedSet(path,value);};});await page.click('#warrantySave');await page.waitForFunction(()=>!document.querySelector('#warrantySave').disabled);assert.equal(await page.evaluate(async()=>(await S.list('expenses')).length),2);await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').maintenance?.length===1);assert.equal(await page.evaluate(()=>EXP.length),2);assert.equal(await page.evaluate(()=>carPL(car('c1')).cost),1400);
 }finally{await page.close();}
});
test('Warranty alert opens its history record; closed claims remain history without active warning',{skip:!process.env.ATLAS_HTML},async()=>{
 const c={...B.testgegevens()['vehicles/c1'],warranties:[{id:'w1',label:'Accu TEST',part:'battery',supplier:'Garage TEST',purchased:'2026-01-01',until:'2026-11-01'}]};
 const {page,fouten}=await notificationPage('nl','/#atlas=vehicle&id=c1&section=warranty&wid=w1&owner=test-owner',null,{'vehicles/c1':c});
 try{await page.waitForFunction(()=>document.activeElement?.id==='warranty-w1');assert.equal(await page.$eval('#careHistory',e=>e.open),true);assert.equal(await page.$eval('.care-warning',e=>e.textContent.includes('Accu')),true);await page.evaluate(()=>{carEdit.warranties[0].claim={status:'closed',date:'2026-10-01',note:'TEST',resolution:'Vervangen TEST'};paintCarSide();});assert.equal(await page.$('.care-warning'),null);assert.equal(await page.$eval('#careHistory',e=>e.open),false);assert.match(await page.$eval('#careHistory',e=>e.textContent),/Vervangen TEST/);assert.deepEqual(fouten,[]);}finally{await page.close();}
});
test('Expanded parts stay synchronized in diagram and form; repair cost updates profit once on phone',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page,fouten}=await B.open({taal:'nl',gegevens:B.testgegevens()});
 try{
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.waitForFunction(()=>typeof openMaintenanceWarranty==='function');await page.evaluate(()=>openCar(car('c1')));
  assert.equal(await page.$$eval('.vehicle-map .parts button',nodes=>nodes.length),13);assert.equal(await page.$eval('.vehicle-map .parts button:last-child',e=>e.textContent),'Overig');assert.equal(await page.$eval('.vehicle-map svg',e=>e.innerHTML.includes('undefined')),false);
  await page.click('#careDone');await page.select('#warrantyAdd select[aria-label="Onderdeel van de auto"]','filters');assert.equal(await page.$eval('.vehicle-map',e=>e.dataset.part),'filters');
  await page.$eval('.vehicle-map [data-part="ac"]',e=>e.scrollIntoView({block:'center'}));await page.tap('.vehicle-map [data-part="ac"]');assert.equal(await page.$eval('#warrantyAdd select',e=>e.value),'ac');
  await page.type('#warrantyAdd input[aria-label="Onderdeel of reparatie"]','Airco TEST');await page.click('#replacementInvoice summary');await page.type('#warrantyAdd input[aria-label="Betaalde prijs (DH, optioneel)"]','600');await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').maintenance?.some(t=>t.label==='Airco TEST'));
  const id=await page.evaluate(()=>car('c1').maintenance.find(t=>t.label==='Airco TEST').id);assert.equal(await page.evaluate(()=>EXP.length),2);assert.equal(await page.evaluate(()=>carPL(car('c1')).cost),1500);assert.equal(await page.$eval('#careHistory',e=>e.open),false);
  await page.evaluate(id=>openMaintenanceWarranty('c1',id),id);await page.click('#replacementInvoice summary');await page.$eval('#warrantyAdd input[aria-label="Betaalde prijs (DH, optioneel)"]',e=>{e.value='650';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('#warrantySave');await page.waitForFunction(()=>carPL(car('c1')).cost===1550);assert.equal(await page.evaluate(()=>EXP.length),2);assert.equal(await page.evaluate(()=>car('c1').maintenance.length),1);assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Existing invoice can be linked without double cost; old warranty amounts are not silently booked',{skip:!process.env.ATLAS_HTML},async()=>{
 const data=B.testgegevens();data['expenses/e1'].date=new Date().toISOString().slice(0,10);const {page,fouten}=await B.open({taal:'fr',gegevens:data});
 try{
  await page.waitForFunction(()=>typeof openMaintenanceWarranty==='function');await page.evaluate(()=>openCar(car('c1')));await page.click('#careDone');await page.type('#warrantyAdd input[aria-label="Pièce ou réparation"]','Facture existante TEST');await page.click('#replacementInvoice summary');await page.type('#warrantyAdd input[aria-label="Prix payé (DH, facultatif)"]','900');assert.equal(await page.$eval('#replacementCost',e=>e.value),'check');await page.click('#warrantySave');assert.equal(await page.evaluate(()=>(car('c1').maintenance||[]).length),0);
  await page.select('#replacementCost','existing:e1');await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').maintenance?.length===1);assert.equal(await page.evaluate(()=>EXP.length),1);assert.equal(await page.evaluate(()=>carPL(car('c1')).cost),900);assert.equal(await page.evaluate(()=>car('c1').maintenance[0].expenseId),'e1');assert.deepEqual(fouten,[]);
 }finally{await page.close();}
 const legacy=B.testgegevens();legacy['vehicles/c1'].warranties=[{id:'legacy',label:'Batterie TEST',supplier:'Garage TEST',purchased:'2026-01-01',until:'2028-01-01',amount:950}];const second=await B.open({taal:'fr',gegevens:legacy});
 try{await second.page.waitForFunction(()=>typeof openMaintenanceWarranty==='function');await second.page.evaluate(()=>openCar(car('c1')));await second.page.click('#careHistory>summary');await second.page.click('#careHistory .card button.link');assert.equal(await second.page.$eval('#replacementCost',e=>e.value),'skip');await second.page.click('#warrantySave');await second.page.waitForFunction(()=>!document.querySelector('#warrantyAdd').open);assert.equal(await second.page.evaluate(()=>EXP.length),1);}finally{await second.page.close();}
});
test('Background refresh preserves form nodes, draft, focus and scroll on desktop and phone',{skip:!process.env.ATLAS_HTML},async()=>{
 for(const mobile of [false,true]){
  const {page,fouten}=await notificationPage('fr');
  try{
   await page.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1280,height:900});await page.waitForFunction(()=>typeof openMaintenanceWarranty==='function');await page.evaluate(()=>{openCar(car('c1'));openMaintenanceWarranty('c1','');});
   await page.type('#warrantyAdd input[aria-label="Pièce ou réparation"]','BROUILLON À CONSERVER');await page.click('#replacementRemind');await page.type('#replacementReminder input[type=number]','50000');await page.click('#replacementCovered');await page.$eval('#replacementWarranty input[type=date]',e=>e.value='2027-12-01');
   const before=await page.evaluate(()=>{window.keptDraft=document.querySelector('#warrantyAdd input[aria-label="Pièce ou réparation"]');document.querySelector('#replacementReminder input').focus();return {y:scrollY,focus:document.activeElement};});
   await page.evaluate(async()=>{window.keptFocus=document.activeElement;for(let i=0;i<3;i++)await sbRond();});
   assert.equal(await page.evaluate(()=>document.querySelector('#warrantyAdd input[aria-label="Pièce ou réparation"]')===window.keptDraft),true);assert.equal(await page.evaluate(()=>document.activeElement===window.keptFocus),true);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before.y)<3);
   assert.equal(await page.$eval('#replacementReminder input[type=number]',e=>e.value),'50000');assert.equal(await page.$eval('#replacementWarranty input[type=date]',e=>e.value),'2027-12-01');assert.equal(await page.$eval('#replacementRemind',e=>e.checked),true);assert.equal(await page.$eval('#replacementCovered',e=>e.checked),true);
   await page.evaluate(()=>document.activeElement.blur());await page.evaluate(()=>sbRond());assert.equal(await page.$eval('#warrantyAdd input[aria-label="Pièce ou réparation"]',e=>e.value),'BROUILLON À CONSERVER');assert.equal(await page.$eval('#warrantyAdd',e=>e.open),true);
   assert.deepEqual(fouten,[]);
  }finally{await page.close();}
 }
});
test('Overview background refresh keeps scroll; navigation during fetch keeps the newly opened draft',async()=>{
 const {page,fouten}=await notificationPage('fr');
 try{
  await page.waitForFunction(()=>NOTIFICATION_READY);await page.evaluate(()=>{view='vFleet';render();document.body.style.minHeight='2500px';window.scrollTo(0,350);});
  const y=await page.evaluate(()=>scrollY);await page.evaluate(()=>sbRond());assert.ok(Math.abs(await page.evaluate(()=>scrollY)-y)<3);
  await page.evaluate(()=>{window.originalRead=sbHaal;window.reads=0;sbHaal=()=>{window.reads++;return new Promise(resolve=>window.finishRead=resolve);};window.refreshInFlight=sbRond();});await page.waitForFunction(()=>typeof window.finishRead==='function');
  await page.evaluate(async()=>{await sbRond();openCar(car('c1'));document.getElementById('cwModel').value='DRAFT FROM OTHER SCREEN';window.scrollTo(0,200);window.finishRead(true);await window.refreshInFlight;sbHaal=window.originalRead;});
  assert.equal(await page.$eval('#cwModel',e=>e.value),'DRAFT FROM OTHER SCREEN');assert.equal(await page.evaluate(()=>window.reads),1);assert.equal(await page.evaluate(()=>view),'vCar');assert.ok(await page.evaluate(()=>scrollY)>100);assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Replacement checkboxes show only needed fields; reminder edits, disabling and warranty remain separate on phone',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page,fouten}=await B.open({taal:'fr',gegevens:B.testgegevens()});
 try{
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.waitForFunction(()=>typeof openMaintenanceWarranty==='function');await page.evaluate(()=>{openCar(car('c1'));openMaintenanceWarranty('c1','');});
  for(const id of ['replacementReminder','replacementWarranty'])assert.equal(await page.$eval('#'+id,e=>e.hidden),true);
  await page.type('#warrantyAdd input[aria-label="Pièce ou réparation"]','Batterie cases TEST');
  await page.click('#replacementCovered');await page.$eval('#replacementWarranty input[type=date]',e=>e.value='2020-01-01');await page.click('#replacementCovered');assert.equal(await page.$eval('#replacementWarranty',e=>e.hidden),true);
  await page.$eval('#replacementRemind',e=>e.scrollIntoView({block:'center'}));await page.tap('#replacementRemind');assert.equal(await page.$eval('#replacementReminder',e=>e.hidden),false);assert.equal(await page.$eval('#replacementWarranty',e=>e.hidden),true);
  await page.click('#warrantySave');assert.equal(await page.evaluate(()=>(car('c1').maintenance||[]).length),0);
  await page.$eval('#replacementReminder input[type=date]',e=>e.value='2026-11-01');await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').maintenance?.length===2);
  let c=await page.evaluate(()=>car('c1'));let completed=c.maintenance.find(x=>x.completedAt);const reminderId=completed.nextReminderId;assert.ok(reminderId);assert.equal(c.warranties?.length||0,0);assert.equal(reminderSummary([{path:'vehicles/c1',data:c}],'2026-10-21').maintenance,1);
  await page.evaluate(id=>openMaintenanceWarranty('c1',id),completed.id);assert.equal(await page.$eval('#replacementRemind',e=>e.checked),true);assert.equal(await page.$eval('#replacementReminder input[type=date]',e=>e.value),'2026-11-01');await page.$eval('#replacementReminder input[type=date]',e=>e.value='2026-11-02');await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').maintenance.some(x=>x.dueDate==='2026-11-02'));assert.equal(await page.evaluate(()=>car('c1').maintenance.length),2);
  await page.evaluate(id=>openMaintenanceWarranty('c1',id),completed.id);await page.click('#replacementCovered');await page.type('#warrantyAdd input[aria-label="Fournisseur / garage"]','Garage TEST');await page.$eval('#replacementWarranty input[type=date]',e=>e.value='2026-11-03');await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').warranties?.length===1);
  await page.evaluate(id=>openMaintenanceWarranty('c1',id),completed.id);assert.equal(await page.$eval('#replacementCovered',e=>e.checked),true);assert.equal(await page.$eval('#replacementCovered',e=>e.disabled),true);await page.click('#replacementRemind');assert.equal(await page.$eval('#replacementReminder',e=>e.hidden),true);await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').maintenance.length===1);c=await page.evaluate(()=>car('c1'));assert.equal(c.warranties.length,1);assert.equal(reminderSummary([{path:'vehicles/c1',data:c}],'2026-10-21').maintenance,0);assert.equal(reminderSummary([{path:'vehicles/c1',data:c}],'2026-10-21').warranties,1);
  assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Two care actions save replacement without warranty and attach automatic alerts without duplicate entries',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page,fouten}=await B.open({taal:'nl',gegevens:B.testgegevens()});
 try{
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.waitForFunction(()=>typeof showPartWarranties==='function');await page.evaluate(()=>openCar(car('c1')));
  assert.equal(await page.$eval('#carePlan b',e=>e.textContent),'Nog te doen');assert.equal(await page.$eval('#careDone b',e=>e.textContent),'Al uitgevoerd');assert.equal(await page.$$eval('.care-actions button',nodes=>nodes.length),2);
  await page.$eval('.vehicle-map [data-part="battery"]',e=>e.scrollIntoView({block:'center'}));await page.tap('.vehicle-map [data-part="battery"]');await page.click('#careDone');
  assert.equal(await page.$eval('#warrantyAdd select[aria-label="Onderdeel van de auto"]',e=>e.value).catch(()=>page.$eval('#warrantyAdd select',e=>e.value)),'battery');
  await page.type('#warrantyAdd input[aria-label="Onderdeel of reparatie"]','Accu vervangen TEST');await page.click('#carePlan');assert.equal(await page.$eval('#warrantyAdd',e=>e.open),false);await page.click('#careDone');assert.equal(await page.$eval('#notificationMaintenance>details',e=>e.open),false);assert.equal(await page.$eval('#warrantyAdd input[aria-label="Onderdeel of reparatie"]',e=>e.value),'Accu vervangen TEST');await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').maintenance?.some(t=>t.label==='Accu vervangen TEST'));
  assert.equal(await page.evaluate(()=>(car('c1').warranties||[]).length),0);
  let c=await page.evaluate(()=>car('c1'));assert.equal(c.maintenance.length,1);assert.equal(c.maintenance[0].part,'battery');assert.equal(reminderSummary([{path:'vehicles/c1',data:c}],'2026-10-21').maintenance,0);
  await page.evaluate(()=>openMaintenanceWarranty('c1',car('c1').maintenance[0].id));await page.type('#warrantyAdd input[aria-label="Leverancier / garage"]','Garage TEST');await page.click('#replacementCovered');await page.$eval('#warrantyAdd input[aria-label="Garantie tot en met"]',e=>{e.value='2026-11-01';});await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').warranties?.length===1);
  c=await page.evaluate(()=>car('c1'));assert.equal(c.maintenance.length,1);assert.equal(c.warranties[0].maintenanceId,c.maintenance[0].id);assert.equal(reminderSummary([{path:'vehicles/c1',data:c}],'2026-10-21').warranties,1);assert.match(reminderItems([{path:'vehicles/c1',data:c}],'2026-10-21').find(x=>x.kind==='warranties').url,/section=warranty&wid=/);
  assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Interactive car selects parts, prefills maintenance and opens linked warranty on desktop and phone',{skip:!process.env.ATLAS_HTML},async()=>{
 for(const mobile of [false,true]){
  const data=B.testgegevens();data['vehicles/c1'].maintenance=[{id:'battery-done',label:'Batterie remplacée',part:'battery',completedAt:'2026-01-10'},{id:'brake-due',label:'Freins à contrôler',part:'brakes',dueKm:30000}];data['vehicles/c1'].warranties=[{id:'w1',maintenanceId:'battery-done',label:'Batterie remplacée',supplier:'Garage test',purchased:'2026-01-10',until:'2028-01-10'}];
  const {page,fouten}=await B.open({taal:'fr',gegevens:data});
  try{
   await page.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1280,height:900});await page.waitForFunction(()=>typeof showPartWarranties==='function');await page.evaluate(()=>openCar(car('c1')));
   const shape='.vehicle-map [data-part="battery"]';await page.$eval(shape,e=>e.scrollIntoView({block:'center'}));if(mobile)await page.tap(shape);else{await page.hover(shape);assert.match(await page.$eval(shape+' title',e=>e.textContent),/Batterie/);await page.click(shape);}
   assert.equal(await page.$eval(shape,e=>e.getAttribute('aria-pressed')),'true',JSON.stringify({mobile,hit:await page.$eval(shape,e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML;}),selected:await page.$eval('.vehicle-map',e=>e.dataset.part)}));assert.match(await page.$eval('.care-selection',e=>e.textContent),/Batterie remplacée/);
   await page.evaluate(()=>[...document.querySelectorAll('.care-selection button')].find(e=>e.textContent.includes('Garantie enregistrée')).click());assert.equal(await page.evaluate(()=>document.activeElement.id),'warranty-w1');
   assert.equal(await page.$eval('.warranty-proof',e=>e.open),false);
   await page.$eval('.vehicle-map [data-part="brakes"]',e=>{e.focus();});await page.keyboard.press('Enter');assert.match(await page.$eval('.care-selection',e=>e.textContent),/Freins à contrôler/);assert.equal(await page.$eval('.vehicle-map [data-part="brakes"]',e=>e.classList.contains('overdue')),true);
   await page.click('#carePlan');assert.equal(await page.$eval('#notificationMaintenance>details select',e=>e.value),'brakes');
   assert.deepEqual(fouten,[]);
   if(mobile)await page.screenshot({path:'tests/schermen/interactive-car-phone.png',fullPage:true});
  }finally{await page.close();}
 }
});
test('Completed maintenance prefills a linked warranty and reopens it without duplicating',{skip:!process.env.ATLAS_HTML},async()=>{
 const data=B.testgegevens();data['vehicles/c1'].maintenance=[{id:'battery-change',label:'Batterie remplacée',part:'battery',dueKm:40000,completedAt:'2026-01-10',completedKm:40000}];
 const {page,fouten}=await B.open({taal:'fr',gegevens:data});
 try{
  await page.waitForFunction(()=>typeof openMaintenanceWarranty==='function');await page.evaluate(()=>{openCar(car('c1'));openMaintenanceWarranty('c1','battery-change');});
  assert.equal(await page.$eval('#warrantyMaintenance',node=>node.value),'battery-change');
  assert.equal(await page.$eval('[aria-label="Pièce ou réparation"]',node=>node.value),'Batterie remplacée');
  assert.equal(await page.$eval('[aria-label="Acheté ou remplacé le"]',node=>node.value),'2026-01-10');
  assert.equal(await page.$eval('[aria-label="Pièce ou réparation"]',node=>node.readOnly),true);
  await page.type('[aria-label="Fournisseur / garage"]','Garage test');await page.click('#replacementCovered');await page.$eval('[aria-label="Garantie jusqu’au"]',node=>{node.value='2028-01-10';});await page.click('#replacementInvoice summary');await page.type('[aria-label="Référence de facture"]','FACT-TEST-1');await page.click('#warrantySave');
  await page.waitForFunction(()=>car('c1').warranties?.length===1);
  const saved=await page.evaluate(()=>car('c1').warranties[0]);assert.equal(saved.maintenanceId,'battery-change');assert.equal(saved.label,'Batterie remplacée');assert.equal(saved.purchased,'2026-01-10');assert.equal(saved.reference,'FACT-TEST-1');
  await page.evaluate(()=>openMaintenanceWarranty('c1','battery-change'));assert.equal(await page.$eval('[aria-label="Fournisseur / garage"]',node=>node.value),'Garage test');await page.click('#warrantySave');
  await page.waitForFunction(()=>!document.getElementById('warrantyAdd').open);assert.equal(await page.evaluate(()=>car('c1').warranties.length),1);assert.equal(await page.evaluate(()=>car('c1').maintenance.length),1);assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Completing maintenance opens its optional warranty with the actual completion date',{skip:!process.env.ATLAS_HTML},async()=>{
 const data=B.testgegevens();data['vehicles/c1'].maintenance=[{id:'brakes',label:'Remmen vervangen',part:'brakes',dueKm:40000}];const {page,fouten}=await B.open({taal:'nl',gegevens:data});
 try{
  await page.waitForFunction(()=>typeof openMaintenanceWarranty==='function');await page.evaluate(()=>{openCar(car('c1'));ask=async()=>true;});
  await page.evaluate(()=>[...document.querySelectorAll('#notificationMaintenance button')].find(button=>button.textContent===maintenanceText().done).click());
  await page.waitForFunction(()=>document.getElementById('warrantyAdd')?.open);
  assert.equal(await page.$eval('#warrantyMaintenance',node=>node.value),'brakes');assert.equal(await page.$eval('[aria-label="Onderdeel of reparatie"]',node=>node.value),'Remmen vervangen');assert.equal(await page.$eval('[aria-label="Gekocht of vervangen op"]',node=>node.value),await page.evaluate(()=>today()));assert.equal(await page.evaluate(()=>car('c1').maintenance[0].completedKm),40000);assert.equal(await page.evaluate(()=>(car('c1').warranties||[]).length),0);assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
async function chooseScanPhotos(page,names){
 const before=await page.$$eval('.guided-card',cards=>cards.length);
 await page.evaluate(async names=>{const transfer=new DataTransfer();for(const name of names){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,640,400);ctx.fillStyle='black';ctx.font='24px Arial';ctx.fillText('SPECIMEN TEST ONLY',20,60);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));transfer.items.add(new File([blob],name,{type:'image/jpeg'}));}const input=document.querySelector('.guided-files');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},names);
 await page.waitForFunction(count=>document.querySelectorAll('.guided-card img').length===count&&[...document.querySelectorAll('.guided-card img')].every(img=>img.naturalWidth>0)&&!document.querySelector('.guided-go').disabled,{},before+names.length);
}
for(const sequential of [false,true])test('Four ID and licence photos survive '+(sequential?'successive additions':'one selection')+' and one scan request',{skip:!process.env.ATLAS_HTML},async()=>{
 const mock={calls:0,status:200,body:{fotos:[
  {foto:0,soort:'id_voor',achternaam:'SPECIMEN',voornamen:'TEST',document_nummer:'AB123456',geboortedatum:'1990-03-04',geldig_tot:'2031-04-05',land:'MAR',mrz:[]},
  {foto:1,soort:'id_achter',document_nummer:'AB123456',land:'MAR',mrz:[]},
  {foto:2,soort:'rijbewijs_voor',rijbewijs_nummer:'07/182101',rijbewijs_afgifte:'2020-06-01',rijbewijs_geldig_tot:'2032-06-30',land:'MAR',mrz:[]},
  {foto:3,soort:'rijbewijs_achter',rijbewijs_nummer:'07/182101',land:'MAR',mrz:[]}
 ]}};
 const {page,fouten}=await notificationPage('nl','/',mock);
 try{
  await page.evaluate(()=>openNew());await page.click('#nwScanKaart');
  const names=['id-front.jpg','id-back.jpg','licence-front.jpg','licence-back.jpg'];
  if(sequential){for(const name of names)await chooseScanPhotos(page,[name]);}else await chooseScanPhotos(page,names);
  assert.deepEqual(await page.$$eval('.guided-card-info span',nodes=>nodes.map(node=>node.textContent)),names);
  await page.click('.guided-go');await page.waitForFunction(()=>SNELKLANT?.licenceNumber==='07/182101');
  assert.deepEqual(await page.evaluate(()=>({id:SNELKLANT.docNumber,expiry:SNELKLANT.docExpiry,licence:SNELKLANT.licenceNumber,licenceExpiry:SNELKLANT.licenceExpiry,scans:Object.keys(SNELKLANT.scans||{}).sort()})),{id:'AB123456',expiry:'2031-04-05',licence:'07/182101',licenceExpiry:'2032-06-30',scans:['cin','cin-voor','licence','licence-voor']});
  assert.equal(mock.calls,1);assert.equal(mock.sent.fotos.length,4);assert.ok(mock.sent.fotos.every(photo=>photo.type==='image/jpeg'&&photo.data.startsWith('/9j/')));assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Four genuine HEIC documents decode locally on a phone-sized screen and send JPEGs',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page,fouten}=await B.open({taal:'fr'});
 try{
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.evaluate(()=>{openNew();window.heicBatch=[];snelScan=async files=>{window.heicBatch=await Promise.all(files.map(async file=>({name:file.name,type:file.type,header:[...new Uint8Array(await file.slice(0,3).arrayBuffer())]})));};});
  await page.click('#nwScanKaart');
  const names=['cin1-voor.heic','cin1-achter.heic','lic1-voor-rotated.heic','lic1-achter.heic'];
  const chooser=page.waitForFileChooser();await page.click('.guided-files');await(await chooser).accept(names.map(name=>new URL('./scanbank/heic/'+name,import.meta.url).pathname));
  await page.waitForFunction(()=>document.querySelectorAll('.guided-card').length===4&&!document.querySelector('.guided-go').disabled,{timeout:30000});
  assert.deepEqual(await page.$$eval('.guided-card-info span',nodes=>nodes.map(node=>node.textContent)),names);
  assert.ok(await page.$$eval('.guided-card img',images=>images.every(image=>image.naturalWidth>0)));
  assert.equal(await page.$$eval('.guided-card img',images=>images[2].naturalHeight>images[2].naturalWidth),true);
  assert.equal(await page.$eval('.guided-error',node=>node.textContent),'');
  assert.equal(await page.$eval('.guided-panel',node=>node.getBoundingClientRect().right<=innerWidth),true);
  await page.click('.guided-go');await page.waitForFunction(()=>window.heicBatch.length===4);
  assert.deepEqual(await page.evaluate(()=>window.heicBatch.map(file=>file.type)),Array(4).fill('image/jpeg'));
  assert.ok(await page.evaluate(()=>window.heicBatch.every(file=>file.header.join(',')==='255,216,255')));assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('An unreadable photo does not discard the four valid document photos',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page}=await B.open({taal:'nl'});
 try{
  await page.evaluate(()=>{openNew();window.keptPhotos=[];snelScan=async files=>{window.keptPhotos=files.map(file=>file.name);};});await page.click('#nwScanKaart');
  const names=['id-front.jpg','id-back.jpg','licence-front.jpg','licence-back.jpg'];await chooseScanPhotos(page,names);
  await page.evaluate(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['broken'],'broken.heic',{type:'image/heic'}));const input=document.querySelector('.guided-files');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('.guided-error').textContent.includes('niet worden geopend')&&!document.querySelector('.guided-go').disabled);
  assert.equal(await page.$$eval('.guided-card',cards=>cards.length),4);await page.click('.guided-go');await page.waitForFunction(()=>window.keptPhotos.length===4);assert.deepEqual(await page.evaluate(()=>window.keptPhotos),names);
 }finally{await page.close();}
});
test('Simple scan adds multiple photos, removes one and sends the remaining batch',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page,fouten}=await B.open({taal:'nl'});
 try{
  await page.evaluate(()=>{openNew();window.guidedBatch=[];snelScan=async files=>{window.guidedBatch=files.map(file=>file.name);};});
  await page.click('#nwScanKaart');await page.waitForSelector('.guided-scan');
  assert.match(await page.$eval('.guided-intro',e=>e.textContent),/herkent zelf/);
  assert.equal(await page.$$eval('.guided-files',inputs=>inputs.length),1);
  assert.equal(await page.$eval('.guided-go',e=>e.disabled),true);
  await chooseScanPhotos(page,['id-front.jpg','id-back.jpg','licence-front.jpg','licence-back.jpg']);
  assert.equal(await page.$eval('.guided-go',e=>e.disabled),false);
  assert.equal(await page.$$eval('.guided-card',cards=>cards.length),4);
  await page.click('.guided-remove');
  await page.click('.guided-go');await page.waitForFunction(()=>window.guidedBatch.length===3);
  assert.deepEqual(await page.evaluate(()=>window.guidedBatch),['id-back.jpg','licence-front.jpg','licence-back.jpg']);
  assert.equal(await page.$('.guided-scan'),null);assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Chosen phone photo is shown immediately before decoding finishes',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page,fouten}=await B.open({taal:'nl'});
 try{
  await page.evaluate(()=>openNew());await page.click('#nwScanKaart');
  const visible=await page.evaluate(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['not decoded yet'],'rijbewijs-uit-fotos.heic',{type:'image/heic'}));const input=document.querySelector('.guided-files');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return {cards:document.querySelectorAll('.guided-card').length,name:document.querySelector('.guided-card-info span')?.textContent};});
  assert.deepEqual(visible,{cards:1,name:'rijbewijs-uit-fotos.heic'});
  await page.waitForFunction(()=>document.querySelector('.guided-error').textContent.includes('niet worden geopend'));
  assert.equal(await page.$$eval('.guided-card',cards=>cards.length),0);assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Moroccan checked MRZ uses national CIN rather than internal card serial',{skip:!process.env.ATLAS_HTML},async()=>{
 const truth=JSON.parse(readFileSync(new URL('./scanbank/waarheid.json',import.meta.url),'utf8')).cin1;
 const mock={calls:0,status:200,body:{fotos:[{foto:0,soort:'id_achter',achternaam:'EL FASSI',voornamen:'SAMIRA',document_nummer:truth.docNumber,geboortedatum:truth.birth,geldig_tot:truth.docExpiry,land:'MAR',mrz:truth.mrz}]}};
 const {page}=await notificationPage('nl','/',mock);
 try{await page.evaluate(()=>openNew());await page.click('#nwScanKaart');await chooseScanPhotos(page,['cin-back.jpg']);await page.click('.guided-go');await page.waitForFunction(()=>SNELKLANT?.docNumber==='BK123456');assert.equal(mock.calls,1);assert.equal(await page.evaluate(()=>SNELKLANT.docExpiry),truth.docExpiry);}finally{await page.close();}
});
test('Automatically recognised licence fills its licence fields',{skip:!process.env.ATLAS_HTML},async()=>{
 const mock={calls:0,status:200,body:{fotos:[
  {foto:0,soort:'id_voor',achternaam:'TEST',voornamen:'SAMIRA',document_nummer:'AB123456',geboortedatum:'1990-03-04',geldig_tot:'2031-04-05',land:'MAR',mrz:[]},
  {foto:1,soort:'id_achter',achternaam:'',voornamen:'',document_nummer:'AB123456',geboortedatum:'',geldig_tot:'',land:'MAR',mrz:[]},
  {foto:2,soort:'rijbewijs_voor',achternaam:'',voornamen:'',document_nummer:'',geboortedatum:'',geldig_tot:'',land:'MAR',rijbewijs_nummer:'07/182101',rijbewijs_geldig_tot:'2032-06-30',mrz:[]}
 ]}};
 const {page}=await notificationPage('nl','/',mock);
 try{
  await page.evaluate(()=>openNew());await page.click('#nwScanKaart');
  await chooseScanPhotos(page,['id-front.jpg','id-back.jpg','licence-front.jpg']);
  await page.click('.guided-go');await page.waitForFunction(()=>SNELKLANT?.licenceNumber==='07/182101');
  assert.equal(await page.evaluate(()=>SNELKLANT.licenceExpiry),'2032-06-30');assert.equal(mock.calls,1);assert.equal(mock.sent.fotos.length,3);for(const photo of mock.sent.fotos){assert.equal(photo.type,'image/jpeg');assert.ok(photo.data.startsWith('/9j/'));assert.ok(photo.data.length>1000);}
 }finally{await page.close();}
});
test('Automatically recognised passport photo alone enables scan and fills passport fields',{skip:!process.env.ATLAS_HTML},async()=>{
 const mock={calls:0,status:200,body:{fotos:[{foto:0,soort:'paspoort',achternaam:'TEST',voornamen:'AMINE',document_nummer:'RX1234567',geboortedatum:'1991-02-03',geldig_tot:'2031-02-03',land:'MAR',mrz:[]}]}};
 const {page}=await notificationPage('nl','/',mock);
 try{
  await page.evaluate(()=>{openNew();fotoVoorAI=async()=>'/9j/AAAAAAAAAAAAAAAAAAAA';});await page.click('#nwScanKaart');
  await chooseScanPhotos(page,['passport.jpg']);
  assert.equal(await page.$eval('.guided-go',e=>e.disabled),false);await page.click('.guided-go');await page.waitForFunction(()=>SNELKLANT?.docNumber==='RX1234567');
  assert.equal(await page.evaluate(()=>SNELKLANT.docType),'passport');assert.equal(mock.calls,1);
 }finally{await page.close();}
});
test('Additional licence upload opens guide, rejects unreadable file and accepts a real photo without rescanning ID',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page}=await B.open({taal:'nl'});
 try{
  await page.evaluate(()=>{openNew();SNELKLANT={name:'TEST',docNumber:'AB123456'};document.getElementById('nwScanLic').hidden=false;window.extraScan=[];snelScan=async files=>{window.extraScan=files.map(f=>f.name);};});
  await page.click('#nwScanLic');await page.waitForSelector('.guided-scan');
  await page.evaluate(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['broken'],'broken.heic',{type:'image/heic'}));const input=document.querySelector('.guided-files');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('.guided-error').textContent.includes('niet worden geopend'));
  assert.equal(await page.$eval('.guided-go',e=>e.disabled),true);
  await chooseScanPhotos(page,['licence.jpg']);assert.equal(await page.$eval('.guided-go',e=>e.disabled),false);
  await page.click('.guided-go');await page.waitForFunction(()=>window.extraScan.length===1);assert.deepEqual(await page.evaluate(()=>window.extraScan),['licence.jpg']);
 }finally{await page.close();}
});
for(const kind of ['passport','licence'])test('Native picker → thumbnail → JPEG request → '+kind+' fields',{skip:!process.env.ATLAS_HTML},async()=>{
 const licence=kind==='licence',number=licence?'07/182101':'RX1234567';
 const mock={calls:0,status:200,body:{fotos:[{foto:0,soort:licence?'rijbewijs_voor':'paspoort',achternaam:'SPECIMEN',voornamen:'TEST',document_nummer:licence?'':number,geboortedatum:'1990-03-04',geldig_tot:licence?'':'2031-04-05',land:'MAR',nationaliteit:'MAR',adres:'',rijbewijs_nummer:licence?number:'',rijbewijs_afgifte:licence?'2020-06-01':'',rijbewijs_geldig_tot:licence?'2030-06-01':'',mrz:[]}]}};
 const {page,fouten}=await notificationPage('nl','/',mock);
 try{
  await page.evaluate(()=>openNew());await page.click('#nwScanKaart');
  const jpeg=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,900,600);ctx.fillStyle='black';ctx.font='30px Arial';ctx.fillText('SPECIMEN TEST ONLY — FICTIONAL',30,80);return c.toDataURL('image/jpeg',.9).split(',')[1];});
  const fixture=join(mkdtempSync(join(tmpdir(),'atlas-native-scan-')),kind+'.jpg');writeFileSync(fixture,Buffer.from(jpeg,'base64'));
  const chooser=page.waitForFileChooser();await page.click('.guided-files');await(await chooser).accept([fixture]);
  await page.waitForFunction(()=>document.querySelector('.guided-card img')?.naturalWidth>0);
  assert.equal(await page.$eval('.guided-go',e=>e.disabled),false);await page.click('.guided-go');
  await page.waitForFunction(({licence,number})=>(licence?SNELKLANT?.licenceNumber:SNELKLANT?.docNumber)===number,{}, {licence,number});
  const values=await page.evaluate(()=>({name:SNELKLANT.name,birth:SNELKLANT.birth,docExpiry:SNELKLANT.docExpiry,licenceIssue:SNELKLANT.licenceIssue,licenceExpiry:SNELKLANT.licenceExpiry,scans:Object.keys(SNELKLANT.scans||{})}));
  assert.equal(values.name,'SPECIMEN TEST');assert.equal(values.birth,'1990-03-04');
  if(licence){assert.equal(values.licenceIssue,'2020-06-01');assert.equal(values.licenceExpiry,'2030-06-01');assert.ok(values.scans.includes('licence-voor'));}else{assert.equal(values.docExpiry,'2031-04-05');assert.ok(values.scans.includes('passport'));}
  assert.equal(mock.calls,1);assert.equal(mock.sent.fotos.length,1);assert.ok(mock.sent.fotos[0].data.startsWith('/9j/'));assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Paid scan prepares multiple photos in parallel and keeps images inside the fast vision budget',{skip:!process.env.ATLAS_HTML},async()=>{
 const mock={calls:0,status:200,body:{fotos:[]}};const {page}=await notificationPage('fr','/',mock);
 try{
  await page.waitForFunction(()=>window.ATLAS_AI_SCAN_ENABLED===true);
  const image=await page.evaluate(async()=>{
   const source=document.createElement('canvas');source.width=2400;source.height=1600;const sourceCtx=source.getContext('2d');const noisy=sourceCtx.createImageData(2400,1600);for(let i=0;i<noisy.data.length;i+=4){noisy.data[i]=(i*17)%256;noisy.data[i+1]=(i*31)%256;noisy.data[i+2]=(i*47)%256;noisy.data[i+3]=255;}sourceCtx.putImageData(noisy,0,0);
   const blob=await new Promise(resolve=>source.toBlob(resolve,'image/jpeg',.95));const data=await fotoVoorAI(new File([blob],'fictional-document.jpg',{type:'image/jpeg'}));
   const decoded=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({width:img.width,height:img.height});img.onerror=reject;img.src='data:image/jpeg;base64,'+data;});
   return {...decoded,bytes:Math.floor(data.length*3/4)};
  });
  assert.ok(image.width<=1500&&image.height<=1500);assert.ok(image.width*image.height<=1100000);assert.ok(image.bytes<990000);
  const concurrency=await page.evaluate(async()=>{
   let active=0,maximum=0;fotoVoorAI=async()=>{active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,40));active--;return '/9j/AAAAAAAAAAAAAAAAAAAA';};
   await aiLees([new File(['a'],'a.jpg'),new File(['b'],'b.jpg')]);return maximum;
  });
  assert.equal(concurrency,2);assert.equal(mock.calls,1);
 }finally{await page.close();}
});
test('Paid scan first; one attempt; outage falls back to local; correction and human review preserved',{skip:!process.env.ATLAS_HTML},async()=>{
 const mock={calls:0,status:200,body:{fotos:[{foto:0,soort:'id_voor',achternaam:'TEST',voornamen:'SAMIRA',document_nummer:'AB123456',geboortedatum:'1990-03-04',geldig_tot:'2031-04-05',land:'MAR',mrz:[]}]}};
 const {page}=await notificationPage('fr','/',mock);
 try{
  await page.waitForFunction(()=>window.ATLAS_AI_SCAN_ENABLED===true);
  await page.evaluate(()=>{openNew();fotoVoorAI=async()=>'/9j/AAAAAAAAAAAAAAAAAAAA';window.localReads=0;soortVanFoto=async()=>{localReads++;return {soort:'cin',zijde:'achter'};};verwerkKeuze=async()=>{$('cvName').value='LOCAL TEST';$('cvDocNo').value='AB123456';};});
  await page.evaluate(()=>snelScan([new File(['test'],'fictive.png',{type:'image/png'})],'auto'));
  assert.equal(mock.calls,1);assert.equal(await page.evaluate(()=>localReads),0);assert.equal(await page.evaluate(()=>SNELKLANT.name),'TEST SAMIRA');assert.equal(await page.evaluate(()=>scanBevestigd()),false);
  await page.evaluate(()=>ctlZet('name','CORRECT TEST'));
  mock.status=503;mock.body={error:'unavailable'};
  await page.evaluate(()=>snelScan([new File(['test'],'fictive.png',{type:'image/png'})],'auto'));
  assert.equal(mock.calls,2);assert.equal(await page.evaluate(()=>localReads),1);assert.equal(await page.evaluate(()=>SNELKLANT.name),'CORRECT TEST');assert.equal(await page.evaluate(()=>scanBevestigd()),false);
 }finally{await page.close();}
});
test('Battery warranty: invoice, correction, defect, claim and resolution survive reload without duplicate cost',async()=>{
  const {page,fouten}=await B.open();
  try{
    await page.waitForFunction(()=>typeof warrantyPanel==='function');await page.evaluate(()=>openCar(car('c1')));
    await page.click('#careDone');
    await page.click('#replacementCovered');await page.click('#replacementInvoice summary');
    for(const [label,value] of [['Pièce ou réparation','Batterie TEST'],['Fournisseur / garage','Garage TEST'],['Prix payé (DH, facultatif)','950'],['Référence de facture','FACT-TEST-1']])await page.type('#warrantyAdd input[aria-label="'+label+'"]',value);
    await page.evaluate(()=>{document.querySelector('#warrantyAdd input[aria-label="Acheté ou remplacé le"]').value=plus(today(),-90);document.querySelector('#warrantyAdd input[aria-label="Garantie jusqu’au"]').value=plus(today(),30);const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4\nTEST ONLY'],'facture-test.pdf',{type:'application/pdf'}));document.querySelector('#warrantyAdd input[type=file]').files=transfer.files;});
    await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').warranties?.length===1);
    let saved=await page.evaluate(()=>car('c1').warranties[0]);assert.equal(saved.amount,950);assert.equal(saved.invoice.name,'facture-test.pdf');assert.match(saved.invoice.data,/^data:application\/pdf;base64,/);
    assert.equal(await page.evaluate(()=>EXP.length),2);assert.equal(await page.evaluate(()=>carPL(car('c1')).cost),1850);
    await page.click('#careHistory>summary');await page.click('#careHistory > .card button.link');
    await page.$eval('#warrantyAdd input[aria-label="Fournisseur / garage"]',e=>e.value='Garage CORRIGÉ');await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').warranties[0].supplier==='Garage CORRIGÉ');
    assert.equal(await page.evaluate(()=>car('c1').warranties.length),1);assert.equal(await page.evaluate(()=>car('c1').warranties[0].invoice.name),'facture-test.pdf');
    await page.click('#careHistory>summary');await page.click('#careHistory > .card details:not(.warranty-proof) summary');
    await page.evaluate(()=>{document.querySelector('#notificationWarranty input[aria-label="Date réelle de la panne"]').value=today();document.querySelector('#notificationWarranty input[aria-label="Kilométrage à la panne"]').value='40100';});
    await page.type('#notificationWarranty input[aria-label="Panne constatée"]','Ne démarre plus');await page.click('#careHistory > .card details button');
    await page.waitForFunction(()=>car('c1').warranties[0].claim?.status==='open');
    await page.click('#careHistory>summary');await page.click('#careHistory > .card details:not(.warranty-proof) summary');await page.type('#notificationWarranty input[aria-label="Résultat : remplacé, remboursé ou refusé"]','Remplacée sous garantie');await page.click('#careHistory > .card details button');await page.waitForFunction(()=>car('c1').warranties[0].claim.status==='closed');
    await page.evaluate(async()=>{await reload();openCar(car('c1'));});assert.match(await page.$eval('#notificationWarranty',e=>e.textContent),/Remplacée sous garantie/);assert.equal(await page.evaluate(()=>EXP.length),2);assert.deepEqual(fouten,[]);
  }finally{await page.close();}
});
test('Account buttons explain missing fields without sending credentials',async()=>{
  const {page}=await B.open({gegevens:{}});
  try{
    await page.evaluate(()=>{view='vSet';render();});
    await page.click('#stCloudNieuw');
    assert.match(await page.$eval('#stCloudStat',e=>e.textContent),/adresse e-mail/);
    await page.type('#stCloudMail','test@example.invalid');
    for(const button of ['stCloudNieuw','stCloudIn']){
      await page.click('#'+button);
      assert.match(await page.$eval('#stCloudStat',e=>e.textContent),/mot de passe/);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'stCloudWw');
      assert.equal(await page.$eval('#'+button,e=>e.disabled),false);
    }
  }finally{await page.close();}
});
test('Registration result remains visible after a background refresh',async()=>{
  const {page}=await B.open({gegevens:{}});
  try{
    await page.evaluate(()=>{
      view='vSet';render();
      window.fetch=async()=>({ok:false,status:429,json:async()=>({error_code:'over_email_send_rate_limit'})});
    });
    await page.type('#stCloudMail','test@example.invalid');
    await page.type('#stCloudWw','temporary-test-value');
    await page.click('#stCloudNieuw');
    await page.waitForFunction(()=>document.querySelector('#stCloudStat').textContent.length>40);
    const melding=await page.$eval('#stCloudStat',e=>e.textContent);
    await page.evaluate(()=>tekenCloud());
    assert.equal(await page.$eval('#stCloudStat',e=>e.textContent),melding);
    assert.equal(await page.$eval('#stCloudWw',e=>e.value),'');
  }finally{await page.close();}
});
test('Admin monitoring distinguishes unknown receipt, safe retry and unavailable monitoring',async()=>{
 const {page}=await B.open();try{
 await page.evaluateOnNewDocument(key=>{if(!location.pathname.endsWith('/admin.html'))return;localStorage.setItem(key,JSON.stringify({access_token:'FAKE-TEST-TOKEN'}));window.retryCalls=0;window.confirm=()=>true;
 window.fetch=async(url,options)=>({ok:true,json:async()=>url.endsWith('atlas_admin_accounts')?{total:1,signed_in_7_days:1,accounts:[]}:url.endsWith('atlas_admin_push_retry')?(window.retryCalls++,true):{without_device:1,items:[{id:'TEST-ID',email:'test@example.invalid',delivery_key:'daily:TEST',created_at:'2026-10-21',attempts:1,status:window.retryCalls?'queued':'unconfirmed',can_retry:!window.retryCalls}]}});},`atlas-test-${TEST_PROJECT}-session`);
 await page.goto(new URL('/admin.html',page.url()).href);await page.waitForFunction(()=>document.querySelector('#pushRows').textContent.includes('Ontvangst onbekend'));
 await page.click('#pushRows button');await page.waitForFunction(()=>document.querySelector('#pushRows').textContent.includes('In wachtrij'));assert.equal(await page.evaluate(()=>retryCalls),1);
 await page.evaluate(()=>{window.fetch=async()=>({ok:false});return loadPush({access_token:'FAKE'});});assert.equal(await page.$$eval('#pushRows tr',x=>x.length),0);assert.match(await page.$eval('#pushStatus',e=>e.textContent),/niet bereikbaar/);
 }finally{await page.close();}
});
test('Admin authorization, safe rendering and clearing stale data',async()=>{
  const {page}=await B.open();
  try{
    await page.evaluateOnNewDocument(key=>{
      if(!location.pathname.endsWith('/admin.html'))return;
      localStorage.setItem(key,JSON.stringify({access_token:'FAKE-TEST-TOKEN'}));
      window.fetch=async()=>({ok:false,status:403});
    },`atlas-test-${TEST_PROJECT}-session`);
    await page.goto(new URL('/admin.html',page.url()).href);
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Geen beheertoegang'));
    assert.equal(await page.$eval('#overview',e=>e.hidden),true);
    await page.evaluate(()=>{window.fetch=async()=>({ok:true,status:200,json:async()=>({total:1,signed_in_7_days:1,accounts:[{email:'<img src=x onerror=alert(1)>',created_at:'2026-01-01',last_sign_in_at:null,verified:true,cars:5,rentals:3}]})});});
    await page.evaluate(()=>load());
    assert.equal(await page.$$eval('#accounts img',e=>e.length),0);
    assert.equal(await page.$eval('#overview',e=>e.hidden),false);
    await page.evaluate(()=>{window.fetch=async()=>({ok:false,status:401});return load();});
    assert.equal(await page.$eval('#overview',e=>e.hidden),true);
    assert.equal(await page.$$eval('#accounts tr',e=>e.length),0);
  }finally{await page.close();}
});
for(const language of ['fr','nl','ar'])test('Pilot screens and rental form: '+language,async()=>{
  const {page,fouten}=await B.open({taal:language});
  try{
    for(const screen of ['vDay','vPlan','vClients','vFleet','vLed','vCash','vSet']){
      await page.evaluate(v=>{view=v;render();},screen);
      assert.equal(await page.evaluate(v=>!document.getElementById(v).hidden,screen),true);
    }
    assert.ok(await page.$('#phoneSettings'));
    await page.evaluate(()=>{openNew();});
    assert.equal(await page.evaluate(()=>!document.getElementById('vNew').hidden),true);
    assert.deepEqual(fouten,[]);
  }finally{await page.close();}
});
for(const width of [390,1176])test('Empty agency layout and planning: '+width,async()=>{
  const {page,fouten}=await B.open({gegevens:{},breed:width,hoog:763});
  try{
    const day=await page.$eval('#dayBody',e=>({display:getComputedStyle(e).display,width:e.getBoundingClientRect().width,empty:e.querySelector('.empty').getBoundingClientRect().width}));
    assert.equal(day.display,'block');
    assert.ok(day.empty>day.width*.9,'empty state must use available width');
    await page.evaluate(()=>{view='vPlan';render();});
    assert.equal(await page.$eval('#planEmpty',e=>e.hidden),false);
    assert.equal(await page.$eval('.planwrap',e=>e.hidden),true);
    await page.click('#planEmpty button');
    assert.equal(await page.$eval('#vCar',e=>e.hidden),false);
    if(width>=1024){
      for(const tab of ['vClients','vLed','vCash','vSet'])assert.notEqual(await page.$eval(`[data-v="${tab}"]`,e=>getComputedStyle(e).display),'none');
      await page.evaluate(()=>{view='vDay';render();});
      if(!process.env.CI)await page.screenshot({path:new URL('../layout-empty-desktop.png',import.meta.url).pathname});
    }
    assert.deepEqual(fouten,[]);
  }finally{await page.close();}
});
