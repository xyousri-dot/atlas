import {test} from 'node:test';
import assert from 'node:assert/strict';
import {warrantyStatus,warrantyValid} from '../supabase/functions/_shared/warranty.mjs';
import {reminderItems,reminderSummary} from '../supabase/functions/_shared/reminders.mjs';
const w={id:'battery',label:'Batterie',supplier:'Garage test',purchased:'2026-01-01',until:'2027-01-01',untilKm:120000};
test('Garantie: afgesproken datum en kilometergrens; eerste overschreden grens telt',()=>{
 assert.equal(warrantyStatus({km:100000},w,'2026-10-18'),'active');
 assert.equal(warrantyStatus({km:119000},w,'2026-10-18'),'soon');
 assert.equal(warrantyStatus({km:120000},w,'2026-10-18'),'soon');
 assert.equal(warrantyStatus({km:120001},w,'2026-10-18'),'expired');
 assert.equal(warrantyStatus({km:100000},w,'2027-01-01'),'soon');
 assert.equal(warrantyStatus({km:100000},w,'2027-01-02'),'expired');
 assert.equal(warrantyStatus({},w,'2026-10-18'),'unknown');
 assert.equal(warrantyStatus({km:0},{...w,until:'',untilKm:null},'2026-10-18'),'unknown');
});
test('Garantieclaim blijft zichtbaar na garantie-einde; afgesloten claim is historie',()=>{
 assert.equal(warrantyStatus({km:150000},{...w,claim:{status:'open'}},'2028-01-01'),'claim');
 assert.equal(warrantyStatus({km:150000},{...w,claim:{status:'closed'}},'2028-01-01'),'closed');
});
test('Geen verzonnen of ongeldige garantievoorwaarden opslaan',()=>{
 assert.equal(warrantyValid(w),true);
 for(const patch of [{supplier:''},{purchased:'2026-02-30'},{until:'2025-01-01'},{until:'',untilKm:0},{amount:-1},{amount:NaN},{untilKm:NaN}])assert.equal(warrantyValid({...w,...patch}),false);
});
test('Dagelijkse garantieherinnering opent betreffende onderdeel en negeert afgehandelde claim',()=>{
 const car={model:'Dacia',km:119500,warranties:[w,{...w,id:'done',claim:{status:'closed'}}]},rows=[{path:'vehicles/c1',data:car}];
 assert.equal(reminderSummary(rows,'2026-10-18').warranties,1);
 const items=reminderItems(rows,'2026-10-18');assert.equal(items.length,1);assert.equal(items[0].url,'./#atlas=vehicle&id=c1&section=warranty&wid=battery');
 assert.equal(car.payments,undefined);
});
