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
