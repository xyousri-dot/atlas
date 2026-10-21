import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as reminders from '../supabase/functions/_shared/reminders.mjs';

// Execute the real handler with isolated in-memory database and push provider.
// No credentials, network requests or customer records are used here.
function service({hour=9,providerError=null}={}){
 const tables={atlas:[],atlas_push_devices:[],atlas_push_deliveries:[]},sent=[];
 class Query{
  constructor(table){this.table=table;this.filters=[];this.op='select';this.max=Infinity;}
  select(){return this;}eq(k,v){this.filters.push(x=>x[k]===v);return this;}limit(n){this.max=n;return this;}
  insert(v){this.op='insert';this.value=v;return this;}update(v){this.op='update';this.value=v;return this;}delete(){this.op='delete';return this;}
  maybeSingle(){this.single=true;return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
   let rows=tables[this.table],found=rows.filter(x=>this.filters.every(f=>f(x))).slice(0,this.max);
   if(this.op==='insert'){
    if(this.table==='atlas_push_deliveries'&&rows.some(x=>x.device_id===this.value.device_id&&x.delivery_key===this.value.delivery_key))return {error:{code:'23505'}};
    rows.push({id:'new-'+rows.length,...this.value});return {data:null};
   }
   if(this.op==='update')found.forEach(x=>Object.assign(x,this.value));
   if(this.op==='delete')tables[this.table]=rows.filter(x=>!found.includes(x));
   return {data:this.single?(found[0]||null):found,error:null};
  }).then(resolve,reject);}
 }
 const env={SUPABASE_URL:'https://manikkusokwysmdfhxtu.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake',ATLAS_PUSH_ENABLED:'true',VAPID_PUBLIC_KEY:'fake',VAPID_PRIVATE_KEY:'fake',VAPID_SUBJECT:'mailto:test@example.invalid',ATLAS_PUSH_ORIGINS:'https://atlas.test',ATLAS_PUSH_CRON_SECRET:'fake-cron'};
 let handler;
 // Future Morocco offsets differ between ICU releases. Select the local hour
 // using this runtime's zone table, exactly as the deployed handler does.
 const zoneHour=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Casablanca',hour:'2-digit',hourCycle:'h23'});
 const now=Array.from({length:24},(_,h)=>Date.parse(`2026-10-18T${String(h).padStart(2,'0')}:05:00Z`)).find(t=>Number(zoneHour.format(new Date(t)))===hour);
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const db={from:t=>new Query(t),auth:{getUser:async token=>({data:{user:token==='owner-a'||token==='owner-b'?{id:token}:null},error:null})}};
 const context={...reminders,localDay:()=>reminders.localDay(new Date(now)),Date:Clock,Intl,Request,Response,URL,Map,JSON,encodeURIComponent,Deno:{env:{get:k=>env[k]},serve:f=>{handler=f;}},createClient:()=>db,webpush:{sendNotification:async(s,p,options)=>{if(providerError)throw providerError;sent.push({endpoint:s.endpoint,payload:JSON.parse(p),options});}}};
 vm.createContext(context);
 const src=readFileSync(new URL('../supabase/functions/atlas-push/index.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
 vm.runInContext(stripTypeScriptTypes(src),context);
 const call=(body,token='owner-a',extra={})=>handler(new Request('https://atlas.test/api',{method:'POST',headers:{origin:'https://atlas.test','content-type':'application/json','x-atlas-user-token':token,...extra},body:JSON.stringify(body)}));
 const device=(id,owner)=>({id,owner_id:owner,endpoint:'https://web.push.apple.com/'+id,language:'fr',subscription:{endpoint:'https://web.push.apple.com/'+id,keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}}});
 return {tables,sent,call,device};
}
test('Examples can be verified separately, use immediate delivery and distinct topics without bypassing daily limits',async()=>{
 const s=service();s.tables.atlas_push_devices.push(s.device('a','owner-a'),s.device('b','owner-b'));
 for(const example of [1,2,0]){const r=await (await s.call({action:'examples',example})).json();assert.equal(r.accepted,1);}
 assert.equal(s.sent.length,3);assert.equal(new Set(s.sent.map(x=>x.options.topic)).size,3);
 assert.ok(s.sent.every(x=>x.endpoint.endsWith('/a')&&x.options.urgency==='high'&&x.payload.title.startsWith('Atlas TEST')));
 assert.equal((await (await s.call({action:'examples',example:1})).json()).duplicate,1);
 assert.equal((await s.call({action:'examples',example:4})).status,400);
});
test('Daily dispatcher isolates owners, links real tasks, omits names and prevents duplicates',async()=>{
 const s=service();s.tables.atlas_push_devices.push(s.device('a','owner-a'),s.device('b','owner-b'));
 s.tables.atlas.push({owner_id:'owner-a',path:'vehicles/a',data:{model:'SECRET MODEL',insuranceUntil:'2026-10-19'}},{owner_id:'owner-b',path:'rentals/b',data:{clientName:'SECRET NAME',from:'2026-10-10',to:'2026-10-17',depart:{},total:500,payments:[]}});
 let response=await s.call({action:'dispatch'},'',{'x-atlas-cron-secret':'fake-cron'});assert.equal(response.status,200);assert.equal((await response.json()).accepted,2);
 assert.equal(s.sent.length,2);assert.ok(s.sent[0].payload.url.includes('id=a'));assert.ok(s.sent[0].payload.url.includes('owner=owner-a'));assert.equal(s.sent[1].payload.url,'./#atlas=alerts&owner=owner-b');
 assert.ok(!JSON.stringify(s.sent).includes('SECRET'));
 await s.call({action:'dispatch'},'',{'x-atlas-cron-secret':'fake-cron'});assert.equal(s.sent.length,2);
 const list=await (await s.call({action:'reminders'},'owner-b')).json();assert.ok(list.items.every(x=>x.id==='b'));
});
test('Maintenance and replacement warranty automatically enter daily dispatch and completed work no longer alerts',async()=>{
 const s=service();s.tables.atlas_push_devices.push(s.device('a','owner-a'));
 const data={model:'TEST CAR',km:40000,maintenance:[{id:'m1',label:'Freins TEST',part:'brakes',dueKm:40500}],warranties:[{id:'w1',label:'Batterie TEST',supplier:'Garage TEST',purchased:'2026-01-01',until:'2026-11-01'}]};
 s.tables.atlas.push({owner_id:'owner-a',path:'vehicles/car1',data});
 const before=await (await s.call({action:'reminders'})).json();assert.ok(before.items.some(x=>x.kind==='maintenance'));assert.ok(before.items.some(x=>x.url.includes('section=warranty&wid=w1')));
 const response=await (await s.call({action:'dispatch'},'',{'x-atlas-cron-secret':'fake-cron'})).json();assert.equal(response.accepted,1);assert.match(s.sent[0].payload.body,/garanties 1/);assert.match(s.sent[0].payload.body,/entretien 1/);
 data.maintenance[0].completedAt='2026-10-18';const after=await (await s.call({action:'reminders'})).json();assert.ok(!after.items.some(x=>x.kind==='maintenance'));assert.ok(after.items.some(x=>x.kind==='warranties'));
 await s.call({action:'dispatch'},'',{'x-atlas-cron-secret':'fake-cron'});assert.equal(s.sent.length,1);
});
test('Scheduler sends delayed test outside daily window and does not send daily reminders early',async()=>{
 const s=service({hour:15}),d=s.device('a','owner-a');d.test_due_at='2026-10-18T00:00:00Z';s.tables.atlas_push_devices.push(d);
 const r=await (await s.call({action:'dispatch'},'',{'x-atlas-cron-secret':'fake-cron'})).json();assert.equal(r.skipped,'outside-morning-window');assert.equal(s.sent.length,1);assert.equal(d.test_due_at,null);
});
test('Expired devices, unauthorized dispatcher and duplicate test scheduling are handled',async()=>{
 const s=service({providerError:{statusCode:410}});s.tables.atlas_push_devices.push(s.device('a','owner-a'));s.tables.atlas.push({owner_id:'owner-a',path:'vehicles/a',data:{insuranceUntil:'2026-10-19'}});
 assert.equal((await s.call({action:'dispatch'})).status,401);assert.equal((await s.call({action:'reminders'},'invalid')).status,401);
 assert.equal((await s.call({action:'test',endpoint:'https://web.push.apple.com/a'},'owner-b')).status,404);
 const r=await (await s.call({action:'dispatch'},'',{'x-atlas-cron-secret':'fake-cron'})).json();assert.equal(r.failed,1);assert.equal(s.tables.atlas_push_devices.length,0);
});
test('Device cannot be linked to a different owner; unsubscribe stops delivery',async()=>{
 const s=service(),d=s.device('a','owner-a');s.tables.atlas_push_devices.push(d);
 assert.equal((await s.call({action:'subscribe',subscription:d.subscription},'owner-b')).status,409);
 await s.call({action:'unsubscribe',endpoint:d.endpoint});assert.equal(s.tables.atlas_push_devices.length,0);
 await s.call({action:'dispatch'},'',{'x-atlas-cron-secret':'fake-cron'});assert.equal(s.sent.length,0);
});
