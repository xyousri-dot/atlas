import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as B from './browser.mjs';
import {TEST_PROJECT} from '../scripts/test-environment.mjs';
import {readFileSync} from 'node:fs';
const appSource=readFileSync(process.env.ATLAS_HTML||new URL('../index.html',import.meta.url),'utf8');
const sessionKey=appSource.match(/SBSKEY="([^"]+)"/)?.[1];
async function notificationPage(language='fr',pad='/',scanMock=null){
  const data=B.testgegevens();data['vehicles/c1'].maintenance=[{id:'m1',label:'Courroie test',dueKm:120000}];data['rentals/cancelled']={...data['rentals/r1'],cancelled:true};
  return B.open({taal:language,gegevens:data,pad,beforeNavigate:async page=>{
    await page.evaluateOnNewDocument(key=>{localStorage.setItem(key,JSON.stringify({access_token:'FAKE-TEST-TOKEN',user:{id:'test-owner'}}));},sessionKey);
    await page.setRequestInterception(true);
    page.on('request',req=>{
      if(req.url().includes('.supabase.co/')){
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
async function chooseScanPhoto(page,index,source,name){
 await page.evaluate(async({index,source,name})=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,640,400);ctx.fillStyle='black';ctx.font='24px Arial';ctx.fillText('SPECIMEN TEST ONLY',20,60);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));const transfer=new DataTransfer();transfer.items.add(new File([blob],name,{type:'image/jpeg'}));const input=document.querySelectorAll('.guided-'+source)[index];input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},{index,source,name});
 await page.waitForFunction(index=>document.querySelectorAll('.guided-row')[index].querySelector('.guided-ok img')?.naturalWidth>0,{},index);
}
test('Guided scan requires both ID sides and sends ID plus optional licence in one batch',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page,fouten}=await B.open({taal:'nl'});
 try{
  await page.evaluate(()=>{openNew();window.guidedBatch=[];snelScan=async files=>{window.guidedBatch=files.map(file=>file.name);};});
  await page.click('#nwScanKaart');await page.waitForSelector('.guided-scan');
  assert.match(await page.$eval('.guided-intro',e=>e.textContent),/ID voor\+achter/);
  assert.equal(await page.$$eval('.guided-row',rows=>rows.length),5);
  assert.equal(await page.$eval('.guided-go',e=>e.disabled),true);
  for(const [index,name,source] of [[0,'id-front.jpg','camera'],[1,'id-back.jpg','camera'],[3,'licence-front.jpg','library'],[4,'licence-back.jpg','library']]){
   await chooseScanPhoto(page,index,source,name);
   if(index===0)assert.equal(await page.$eval('.guided-go',e=>e.disabled),true);
  }
  assert.equal(await page.$eval('.guided-go',e=>e.disabled),false);
  assert.deepEqual(await page.$$eval('.guided-ok',states=>states.map(s=>s.textContent)),['✓ Gereed · id-front.jpg','✓ Gereed · id-back.jpg','✓ Gereed · licence-front.jpg','✓ Gereed · licence-back.jpg']);
  await page.click('.guided-go');await page.waitForFunction(()=>window.guidedBatch.length===4);
  assert.deepEqual(await page.evaluate(()=>window.guidedBatch),['id-front.jpg','id-back.jpg','licence-front.jpg','licence-back.jpg']);
  assert.equal(await page.$('.guided-scan'),null);assert.deepEqual(fouten,[]);
 }finally{await page.close();}
});
test('Guided licence file fills licence fields even when the model labels it generically',{skip:!process.env.ATLAS_HTML},async()=>{
 const mock={calls:0,status:200,body:{fotos:[
  {foto:0,soort:'id_voor',achternaam:'TEST',voornamen:'SAMIRA',document_nummer:'AB123456',geboortedatum:'1990-03-04',geldig_tot:'2031-04-05',land:'MAR',mrz:[]},
  {foto:1,soort:'id_achter',achternaam:'',voornamen:'',document_nummer:'AB123456',geboortedatum:'',geldig_tot:'',land:'MAR',mrz:[]},
  {foto:2,soort:'ander',achternaam:'',voornamen:'',document_nummer:'07/182101',geboortedatum:'',geldig_tot:'2032-06-30',land:'MAR',mrz:[]}
 ]}};
 const {page}=await notificationPage('nl','/',mock);
 try{
  await page.evaluate(()=>openNew());await page.click('#nwScanKaart');
  for(const [index,name,source] of [[0,'id-front.jpg','camera'],[1,'id-back.jpg','camera'],[3,'licence-front.jpg','library']])await chooseScanPhoto(page,index,source,name);
  await page.click('.guided-go');await page.waitForFunction(()=>SNELKLANT?.licenceNumber==='07/182101');
  assert.equal(await page.evaluate(()=>SNELKLANT.licenceExpiry),'2032-06-30');assert.equal(mock.calls,1);assert.equal(mock.sent.fotos.length,3);for(const photo of mock.sent.fotos){assert.equal(photo.type,'image/jpeg');assert.ok(photo.data.startsWith('/9j/'));assert.ok(photo.data.length>1000);}
 }finally{await page.close();}
});
test('Guided passport photo alone enables scan and fills passport fields',{skip:!process.env.ATLAS_HTML},async()=>{
 const mock={calls:0,status:200,body:{fotos:[{foto:0,soort:'ander',achternaam:'TEST',voornamen:'AMINE',document_nummer:'RX1234567',geboortedatum:'1991-02-03',geldig_tot:'2031-02-03',land:'MAR',mrz:[]}]}};
 const {page}=await notificationPage('nl','/',mock);
 try{
  await page.evaluate(()=>{openNew();fotoVoorAI=async()=>'/9j/AAAAAAAAAAAAAAAAAAAA';});await page.click('#nwScanKaart');
  await chooseScanPhoto(page,2,'library','passport.jpg');
  assert.equal(await page.$eval('.guided-go',e=>e.disabled),false);await page.click('.guided-go');await page.waitForFunction(()=>SNELKLANT?.docNumber==='RX1234567');
  assert.equal(await page.evaluate(()=>SNELKLANT.docType),'passport');assert.equal(mock.calls,1);
 }finally{await page.close();}
});
test('Additional licence upload opens guide, rejects unreadable file and accepts a real photo without rescanning ID',{skip:!process.env.ATLAS_HTML},async()=>{
 const {page}=await B.open({taal:'nl'});
 try{
  await page.evaluate(()=>{openNew();SNELKLANT={name:'TEST',docNumber:'AB123456'};document.getElementById('nwScanLic').hidden=false;window.extraScan=[];snelScan=async files=>{window.extraScan=files.map(f=>f.name);};});
  await page.click('#nwScanLic');await page.waitForSelector('.guided-scan');
  await page.evaluate(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['broken'],'broken.heic',{type:'image/heic'}));const input=document.querySelectorAll('.guided-library')[3];input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('.guided-error').textContent.includes('niet worden geopend'));
  assert.equal(await page.$eval('.guided-go',e=>e.disabled),true);
  await chooseScanPhoto(page,3,'library','licence.jpg');assert.equal(await page.$eval('.guided-go',e=>e.disabled),false);
  await page.click('.guided-go');await page.waitForFunction(()=>window.extraScan.length===1);assert.deepEqual(await page.evaluate(()=>window.extraScan),['licence.jpg']);
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
    await page.click('#warrantyAdd summary');
    for(const [label,value] of [['Pièce ou réparation','Batterie TEST'],['Fournisseur / garage','Garage TEST'],['Prix payé (DH, facultatif)','950'],['Référence de facture','FACT-TEST-1']])await page.type('#warrantyAdd input[aria-label="'+label+'"]',value);
    await page.evaluate(()=>{document.querySelector('#warrantyAdd input[aria-label="Acheté ou remplacé le"]').value=plus(today(),-90);document.querySelector('#warrantyAdd input[aria-label="Garantie jusqu’au"]').value=plus(today(),30);const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4\nTEST ONLY'],'facture-test.pdf',{type:'application/pdf'}));document.querySelector('#warrantyAdd input[type=file]').files=transfer.files;});
    await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').warranties?.length===1);
    let saved=await page.evaluate(()=>car('c1').warranties[0]);assert.equal(saved.amount,950);assert.equal(saved.invoice.name,'facture-test.pdf');assert.match(saved.invoice.data,/^data:application\/pdf;base64,/);
    assert.equal(await page.evaluate(()=>EXP.length),1);
    await page.click('#notificationWarranty > .card button.link');
    await page.$eval('#warrantyAdd input[aria-label="Fournisseur / garage"]',e=>e.value='Garage CORRIGÉ');await page.click('#warrantySave');await page.waitForFunction(()=>car('c1').warranties[0].supplier==='Garage CORRIGÉ');
    assert.equal(await page.evaluate(()=>car('c1').warranties.length),1);assert.equal(await page.evaluate(()=>car('c1').warranties[0].invoice.name),'facture-test.pdf');
    await page.click('#notificationWarranty > .card details summary');
    await page.evaluate(()=>{document.querySelector('#notificationWarranty input[aria-label="Date réelle de la panne"]').value=today();document.querySelector('#notificationWarranty input[aria-label="Kilométrage à la panne"]').value='40100';});
    await page.type('#notificationWarranty input[aria-label="Panne constatée"]','Ne démarre plus');await page.click('#notificationWarranty > .card details button');
    await page.waitForFunction(()=>car('c1').warranties[0].claim?.status==='open');
    await page.click('#notificationWarranty > .card details summary');await page.type('#notificationWarranty input[aria-label="Résultat : remplacé, remboursé ou refusé"]','Remplacée sous garantie');await page.click('#notificationWarranty > .card details button');await page.waitForFunction(()=>car('c1').warranties[0].claim.status==='closed');
    await page.evaluate(async()=>{await reload();openCar(car('c1'));});assert.match(await page.$eval('#notificationWarranty',e=>e.textContent),/Remplacée sous garantie/);assert.equal(await page.evaluate(()=>EXP.length),1);assert.deepEqual(fouten,[]);
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
