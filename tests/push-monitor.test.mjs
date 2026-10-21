import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPushMonitor,pushFailure} from '../supabase/functions/_shared/push-monitor.mjs';
function harness(){
 const jobs=new Map();let count=0,now=0,error=null,loseResult=false;const sent=[];
 const db={rpc:async(name,p={})=>{
  if(name==='atlas_push_enqueue'){let q=[...jobs.values()].find(x=>x.device_id===p.p_device&&x.delivery_key===p.p_key);if(!q){q={id:'11111111-1111-1111-1111-'+String(++count).padStart(12,'0'),receipt_token:'22222222-2222-2222-2222-222222222222',device_id:p.p_device,owner_id:p.p_owner,delivery_key:p.p_key,payload:p.p_payload,attempts:0,state:'queued',due:now,subscription:{endpoint:'https://web.push.apple.com/TEST'}};jobs.set(q.id,q);}return {data:q.id};}
  if(name==='atlas_push_due')return {data:[...jobs.values()].filter(q=>['queued','failed'].includes(q.state)&&q.attempts<3&&q.due<=now&&!q.received_at).map(q=>q.id)};
  const q=jobs.get(p.p_id);if(!q)return {data:null};
  if(name==='atlas_push_claim'){if(!['queued','failed'].includes(q.state)||q.attempts>=3||q.received_at||q.due>now)return {data:null};q.state='sending';q.attempts++;return {data:{...q}};}
  if(name==='atlas_push_result'){if(loseResult)return {error:{message:'TEST STORAGE ERROR'}};if(q.attempts===p.p_attempt&&q.state==='sending'){q.state=p.p_state;q.error=p.p_code;q.due=p.p_state==='failed'?now+(q.attempts===1?60000:300000):Infinity;}return {data:null};}
  if(name==='atlas_push_ack'){if(q.receipt_token!==p.p_token)return {data:false};q[p.p_event==='opened'?'opened_at':'received_at']=now+1;return {data:true};}
  throw Error(name);
 }};
 const monitor=createPushMonitor(db,{sendNotification:async(sub,p,options)=>{sent.push({sub,payload:JSON.parse(p),options});if(error)throw error;}},{vapid:{}});
 return {monitor,jobs,sent,device:{id:'device-a',owner_id:'owner-a'},setError:e=>error=e,advance:ms=>now+=ms,loseResult:()=>loseResult=true};
}
test('Durable warning remains after transient failure; retry succeeds once with the same receipt and topic',async()=>{
 const h=harness();h.setError({statusCode:503});assert.equal(await h.monitor.send(h.device,{body:'TEST'},'daily:TEST'),'failed');
 const q=[...h.jobs.values()][0];assert.equal(q.state,'failed');assert.equal(q.attempts,1);assert.equal(q.payload.body,'TEST');
 assert.deepEqual(await h.monitor.dispatch(),[]);h.advance(60000);h.setError(null);assert.deepEqual(await h.monitor.dispatch(),['accepted']);assert.equal(q.attempts,2);
 assert.equal(h.sent[0].options.topic,h.sent[1].options.topic);assert.deepEqual(h.sent[0].payload.receipt,h.sent[1].payload.receipt);
 assert.equal(await h.monitor.send(h.device,{body:'TEST'},'daily:TEST'),'duplicate');assert.equal(h.sent.length,2);
});
test('Concurrent send claims one attempt; accepted without receipt is not silently resent',async()=>{
 const h=harness();await Promise.all([h.monitor.send(h.device,{},'same'),h.monitor.send(h.device,{},'same')]);assert.equal(h.sent.length,1);h.advance(86400000);assert.deepEqual(await h.monitor.dispatch(),[]);
});
test('Permanent and ambiguous failures stay visible; no automatic timeout duplicates; at most three definite retries',async()=>{
 for(const [error,state] of [[{statusCode:410},'gone'],[{},'unknown'],[{statusCode:401},'unknown']]){const h=harness();h.setError(error);await h.monitor.send(h.device,{},'TEST');assert.equal([...h.jobs.values()][0].state,state);h.advance(86400000);assert.deepEqual(await h.monitor.dispatch(),[]);}
 const h=harness();h.setError({statusCode:429});await h.monitor.send(h.device,{},'TEST');h.advance(60000);await h.monitor.dispatch();h.advance(300000);await h.monitor.dispatch();h.advance(86400000);await h.monitor.dispatch();assert.equal(h.sent.length,3);assert.equal([...h.jobs.values()][0].state,'failed');
});
test('Acknowledgements are idempotent, scoped to a random delivery token and stop queued retries',async()=>{
 const h=harness();h.setError({statusCode:503});await h.monitor.send(h.device,{},'TEST');const q=[...h.jobs.values()][0];
 assert.equal(await h.monitor.ack({id:q.id,token:'33333333-3333-3333-3333-333333333333',event:'received'}),false);
 for(const event of ['received','received','opened'])assert.equal(await h.monitor.ack({id:q.id,token:q.receipt_token,event}),true);
 assert.equal(await h.monitor.ack({id:q.id,token:q.receipt_token,event:'resend'}),false);h.advance(60000);assert.deepEqual(await h.monitor.dispatch(),[]);assert.ok(q.opened_at);
});
test('A result-storage interruption never turns an uncertain send into success or a blind retry',async()=>{
 const h=harness();h.loseResult();await assert.rejects(h.monitor.send(h.device,{},'TEST'),/push-storage/);assert.equal([...h.jobs.values()][0].state,'sending');h.advance(86400000);assert.deepEqual(await h.monitor.dispatch(),[]);assert.equal(h.sent.length,1);
});
test('Failure classification does not leak provider bodies or private endpoints',()=>{
 assert.deepEqual(pushFailure({statusCode:503,body:'PRIVATE'}),{state:'failed',code:'503'});assert.deepEqual(pushFailure(Error('PRIVATE')),{state:'unknown',code:'network-uncertain'});
});
