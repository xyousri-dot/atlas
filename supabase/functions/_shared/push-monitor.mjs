// Test-only durable delivery orchestration. Database claims serialize attempts.
export function pushFailure(error){
 const code=Number(error?.statusCode||0);
 if(code===404||code===410)return {state:'gone',code:String(code)};
 if(code===429||code>=500&&code<=599)return {state:'failed',code:String(code)};
 // A timeout can mean the provider accepted the message but its response was
 // lost. Never automatically duplicate it. An administrator may retry later.
 return {state:'unknown',code:code?String(code):'network-uncertain'};
}
export function createPushMonitor(db,provider,settings){
 async function rpc(name,args={}){const r=await db.rpc(name,args);if(r.error)throw Error('push-storage');return r.data;}
 async function deliver(id){
  const job=await rpc('atlas_push_claim',{p_id:id});if(!job)return 'duplicate';
  const receipt={id:job.id,token:job.receipt_token};
  const payload={...job.payload,receipt};
  let outcome={state:'accepted',code:null};
  try{
   await provider.sendNotification(job.subscription,JSON.stringify(payload),{
    TTL:3600,timeout:5000,urgency:job.delivery_key.includes('example')?'high':'normal',
    topic:job.id.replaceAll('-',''),vapidDetails:settings.vapid
   });
  }catch(e){outcome=pushFailure(e);}
  // If recording the result fails, the durable lease becomes 'unknown', never
  // silently successful or automatically resent after an ambiguous attempt.
  await rpc('atlas_push_result',{p_id:id,p_attempt:job.attempts,p_state:outcome.state,p_code:outcome.code});
  return outcome.state==='accepted'?'accepted':'failed';
 }
 return {
  async send(device,payload,key){
   const id=await rpc('atlas_push_enqueue',{p_owner:device.owner_id,p_device:device.id,p_key:key,p_payload:payload});
   return deliver(id);
  },
  async dispatch(){const ids=await rpc('atlas_push_due');const results=[];for(const id of (ids||[]).slice(0,5))results.push(await deliver(id));return results;},
  async ack(body){
   if(!/^[0-9a-f-]{36}$/i.test(body.id||'')||!/^[0-9a-f-]{36}$/i.test(body.token||'')||!['received','opened','display-error'].includes(body.event))return false;
   return !!await rpc('atlas_push_ack',{p_id:body.id,p_token:body.token,p_event:body.event});
  }
 };
}
