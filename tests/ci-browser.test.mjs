import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as B from './browser.mjs';
before(B.start);after(B.stop);
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
