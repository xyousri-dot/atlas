import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as B from './browser.mjs';
import {TEST_PROJECT} from '../scripts/test-environment.mjs';
before(B.start);after(B.stop);
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
