// Shared source for the isolated atlas-test service; customer release is separate.
import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {localDay,reminderSummary,reminderItems,summaryPayload,validSubscription} from '../_shared/reminders.mjs';
import {createPushMonitor} from '../_shared/push-monitor.mjs';

const env=(name:string)=>Deno.env.get(name)||'';
const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
const origins=env('ATLAS_PUSH_ORIGINS').split(',').filter(Boolean);
const allowed=()=>env('ATLAS_PUSH_ENABLED')==='true'&&!!env('VAPID_PUBLIC_KEY')&&!!env('VAPID_PRIVATE_KEY')&&!!env('VAPID_SUBJECT');
const monitor=env('SUPABASE_URL')==='https://manikkusokwysmdfhxtu.supabase.co'?createPushMonitor(db,webpush,{vapid:{subject:env('VAPID_SUBJECT'),publicKey:env('VAPID_PUBLIC_KEY'),privateKey:env('VAPID_PRIVATE_KEY')}}):null;
function check(result:any){if(result.error)throw new Error('storage');return result.data;}
async function send(device:any,payload:any,key:string){
  payload={...payload,url:(payload.url||'./#atlas=alerts')+((payload.url||'').includes('#')?'&':'#')+'owner='+encodeURIComponent(device.owner_id)};
  if(monitor)return monitor.send(device,payload,key);
  const claim=await db.from('atlas_push_deliveries').insert({device_id:device.id,delivery_key:key});
  if(claim.error?.code==='23505')return 'duplicate';
  check(claim);
  try{
    const testExample=payload.tag?.startsWith('atlas-linked-example-');
    await webpush.sendNotification(device.subscription,JSON.stringify(payload),{TTL:3600,timeout:10000,...(testExample?{urgency:'high',topic:payload.tag}:{}),vapidDetails:{subject:env('VAPID_SUBJECT'),publicKey:env('VAPID_PUBLIC_KEY'),privateKey:env('VAPID_PRIVATE_KEY')}});
    // Accepted by push provider; NOT proof of phone display/delivery.
    return 'accepted';
  }catch(e:any){
    if(e.statusCode===404||e.statusCode===410)check(await db.from('atlas_push_devices').delete().eq('id',device.id));
    // Keep the daily claim after an ambiguous network failure: avoid duplicate alerts.
    return 'failed';
  }
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')||'';
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-atlas-user-token','Access-Control-Allow-Methods':'POST,OPTIONS'});
  const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.includes(origin))return reply({error:'origin'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({error:'method'},405);
  if(!allowed())return reply({error:'not-configured'},503);
  if(Number(req.headers.get('content-length')||0)>4096)return reply({error:'size'},413);
  try{
    const text=await req.text();if(text.length>4096)return reply({error:'size'},413);
    const body=JSON.parse(text);
    // A random, per-delivery capability can only confirm that single delivery.
    // It cannot read accounts, customer data, subscriptions or resend messages.
    if(body.action==='receipt'&&monitor)return reply({recorded:await monitor.ack(body)});
    if(body.action==='dispatch'){
      const secret=env('ATLAS_PUSH_CRON_SECRET');
      if(!secret||req.headers.get('x-atlas-cron-secret')!==secret)return reply({error:'unauthorized'},401);
      const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Casablanca',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
      // Bound each draft invocation; larger fleets require paginated jobs before rollout.
      const devices=check(await db.from('atlas_push_devices').select('*').limit(101));
      if(devices.length>100)return reply({error:'batch-limit'},503);
      const day=localDay(),results=monitor?await monitor.dispatch():[];
      for(const device of devices){
        if(device.disabled_at)continue;
        if(device.test_due_at && Date.parse(device.test_due_at)<=Date.now() && validSubscription(device.subscription)){
          results.push(await send(device,{body:'Atlas · Test de notification / Testmelding',tag:'atlas-test',url:'./'},'test:'+day));
          check(await db.from('atlas_push_devices').update({test_due_at:null}).eq('id',device.id));
        }
      }
      if(hour!==9)return reply({skipped:'outside-morning-window',testResults:results});
      const byOwner=new Map();
      for(const device of devices){
        if(device.disabled_at)continue;
        if(!validSubscription(device.subscription))continue;
        if(!byOwner.has(device.owner_id)){
          const rows=check(await db.from('atlas').select('path,data').eq('owner_id',device.owner_id).limit(1001));
          if(rows.length>1000)throw Error('agency-limit');
          byOwner.set(device.owner_id,{counts:reminderSummary(rows,day),items:reminderItems(rows,day)});
        }
        const summary=byOwner.get(device.owner_id);
        const payload=summaryPayload(summary.counts,device.language,summary.items);
        if(payload)results.push(await send(device,payload,'daily:'+day));
      }
      return reply({accepted:results.filter(x=>x==='accepted').length,failed:results.filter(x=>x==='failed').length});
    }
    // Do not trust user ids or JWT claims supplied in the request body.
    const token=req.headers.get('x-atlas-user-token')||(req.headers.get('authorization')||'').replace(/^Bearer /,'');
    const {data,error}=await db.auth.getUser(token);
    if(error||!data.user)return reply({error:'unauthorized'},401);
    const owner=data.user.id;
    if(body.action==='reminders'){
      const rows=check(await db.from('atlas').select('path,data').eq('owner_id',owner).limit(1001));
      if(rows.length>1000)return reply({error:'agency-limit'},503);
      return reply({items:reminderItems(rows)});
    }
    // Fixed, clearly labelled examples, available only in the isolated test project.
    if(body.action==='examples'&&env('SUPABASE_URL')==='https://manikkusokwysmdfhxtu.supabase.co'){
      if(body.example!==undefined&&![0,1,2].includes(body.example))return reply({error:'example'},400);
      const devices=check(await db.from('atlas_push_devices').select('*').eq('owner_id',owner));
      const rows=check(await db.from('atlas').select('path,data').eq('owner_id',owner).limit(1000));
      const vehicle=rows.find(r=>r.path.startsWith('vehicles/'));
      const rental=rows.find(r=>r.path.startsWith('rentals/'));
      const target=(row,section)=>row?'./#atlas='+(row.path.startsWith('vehicles/')?'vehicle':'rental')+'&id='+encodeURIComponent(row.path.split('/')[1])+'&section='+section:'./#atlas=alerts';
      const urls=[target(vehicle,'maintenance'),target(vehicle,'documents'),target(rental,'balances')];
      const examples=[
        'TEST · Entretien : courroie à vérifier avant 120 000 km. Exemple fictif.',
        'TEST · Document : assurance à renouveler dans 7 jours. Exemple fictif.',
        'TEST · Paiement : location avec solde à encaisser. Exemple fictif.'
      ];
      const results=[];
      for(const device of devices){
        if(device.disabled_at)continue;
        if(!validSubscription(device.subscription))continue;
        for(const [i,message] of examples.entries()){
          if(body.example!==undefined&&body.example!==i)continue;
          if(body.startup===true&&i!==2)continue;
          results.push(await send(device,{title:['Atlas TEST · Entretien','Atlas TEST · Assurance','Atlas TEST · Paiement'][i],body:(body.startup===true?'TEST OUVERTURE · ':'')+message,tag:'atlas-linked-example-'+i,url:urls[i]},(body.startup===true?'startup-example:':monitor?'monitored-example-v1:':'linked-example-v2:')+localDay()+':'+i));
        }
      }
      return reply({accepted:results.filter(x=>x==='accepted').length,failed:results.filter(x=>x==='failed').length,duplicate:results.filter(x=>x==='duplicate').length});
    }
    if(body.action==='config')return reply({publicKey:env('VAPID_PUBLIC_KEY')});
    if(body.action==='status'){
      const device=check(await db.from('atlas_push_devices').select(monitor?'id,disabled_at':'id').eq('owner_id',owner).eq('endpoint',body.endpoint).maybeSingle());
      return reply({registered:!!device&&!device.disabled_at});
    }
    if(body.action==='subscribe'){
      if(!validSubscription(body.subscription))return reply({error:'subscription'},400);
      const endpoint=body.subscription.endpoint;
      const existing=check(await db.from('atlas_push_devices').select('id,owner_id').eq('endpoint',endpoint).maybeSingle());
      if(existing&&existing.owner_id!==owner)return reply({error:'device-already-linked'},409);
      const fields={owner_id:owner,endpoint,subscription:body.subscription,language:['fr','nl','ar'].includes(body.language)?body.language:'fr',...(monitor?{disabled_at:null}:{})};
      if(existing)check(await db.from('atlas_push_devices').update(fields).eq('id',existing.id).eq('owner_id',owner));
      else check(await db.from('atlas_push_devices').insert(fields));
      return reply({registered:true});
    }
    if(body.action==='unsubscribe'){
      check(await db.from('atlas_push_devices').delete().eq('owner_id',owner).eq('endpoint',body.endpoint));return reply({removed:true});
    }
    if(body.action==='test'){
      const device=check(await db.from('atlas_push_devices').select('*').eq('owner_id',owner).eq('endpoint',body.endpoint).maybeSingle());
      if(!device)return reply({error:'not-found'},404);
      const previous=check(await db.from('atlas_push_deliveries').select('device_id').eq('device_id',device.id).eq('delivery_key','test:'+localDay()).maybeSingle());
      if(previous)return reply({error:'daily-test-limit'},429);
      if(!device.test_due_at)check(await db.from('atlas_push_devices').update({test_due_at:new Date(Date.now()+60000).toISOString()}).eq('id',device.id));
      return reply({scheduled:true,afterSeconds:60});
    }
    return reply({error:'action'},400);
  }catch{return reply({error:'notification-service'},500);}
});
