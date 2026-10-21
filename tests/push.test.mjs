import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {reminderSummary,reminderItems,summaryPayload,validSubscription,localDay} from '../supabase/functions/_shared/reminders.mjs';
test('Waarschuwingen linken naar eigen auto of contract en samenvatting naar takenlijst',()=>{
 const rows=[{path:'vehicles/car 1',data:{model:'Clio',km:119500,maintenance:[{dueKm:120000}],insuranceUntil:'2026-10-18'}},{path:'rentals/r1',data:{from:'2026-10-17',total:500}}];
 const items=reminderItems(rows,'2026-10-17');
 assert.ok(items.some(x=>x.url==='./#atlas=vehicle&id=car%201&section=documents&doc=insuranceUntil'));
 assert.ok(items.some(x=>x.url==='./#atlas=vehicle&id=car%201&section=maintenance'));
 assert.ok(items.some(x=>x.url==='./#atlas=rental&id=r1&section=balances'));
 assert.equal(summaryPayload({documents:1},'fr',[items[0]]).url,items[0].url);
 assert.equal(summaryPayload({documents:2},'fr',items).url,'./#atlas=alerts');
});
test('Meldingslink wacht op aanmelden, weigert ander account en opent juiste actuele kaart',async()=>{
 const a=zandbak(scriptUit(leesHtml()));a.URLSearchParams=URLSearchParams;a.location={hash:'#atlas=vehicle&id=c1&section=documents'};a.NOTIFICATION_BUSY=false;a.NOTIFICATION_READY=true;
 const calls=[];a.toast=x=>calls.push('notice');a.notificationProblem=()=>calls.push('notice');a.naarAanmelden=()=>calls.push('login');a.sbKlaar=()=>false;
 await a.openNotificationTarget();assert.deepEqual(calls,['login','notice']);
 calls.length=0;a.sbKlaar=()=>true;a.SBSES={user:{id:'owner1'}};a.location.hash+='&owner=other';await a.openNotificationTarget();assert.deepEqual(calls,['login','notice']);
 calls.length=0;a.location.hash='#atlas=vehicle&id=c1&section=documents';a.sbHaal=async()=>{calls.push('cloud');return true;};a.reload=async()=>{};a.CARS=[{id:'c1'}];a.$=id=>id==='cwIns'?{scrollIntoView(){calls.push('documents');},setAttribute(){},focus(){}}:null;a.openCar=x=>calls.push(x.id);
 await a.openNotificationTarget();assert.deepEqual(calls,['cloud','c1','documents']);
 calls.length=0;a.location.hash='#atlas=rental&id=r1&section=balances';a.RENTALS=[{id:'r1',retour:{}}];a.$=id=>id==='rTitle'?{textContent:''}:null;a.receipt=(r,k)=>calls.push(r.id+':'+k);await a.openNotificationTarget();assert.deepEqual(calls,['cloud','r1:retour']);
 calls.length=0;a.location.hash='#atlas=vehicle&id=deleted';await a.openNotificationTarget();assert.deepEqual(calls,['cloud','notice']);
 calls.length=0;a.sbHaal=async()=>false;await a.openNotificationTarget();assert.deepEqual(calls,['notice']);
});
test('Een meldingslink opent pas nadat het opstartscherm klaar is',async()=>{
 const a=zandbak(scriptUit(leesHtml()));a.location={hash:'#atlas=vehicle&id=c1'};a.NOTIFICATION_READY=false;a.NOTIFICATION_BUSY=false;
 let reads=0;a.sbKlaar=()=>true;a.sbHaal=async()=>{reads++;return true;};
 await a.openNotificationTarget();assert.equal(reads,0);
 const source=leesHtml();assert.ok(source.includes('notificationBootBase();NOTIFICATION_READY=true;openNotificationTarget();recoverNotificationTarget()'));
});
test('Telefoonwaarschuwing gebruikt dezelfde huursaldi en borginhouding als afrekening',()=>{
 const rental={from:'2026-10-10',to:'2026-10-12',total:500,depart:{},retour:{},limit:'2026-10-17',payments:[{kind:'rent',amount:400},{kind:'refund',amount:-100},{kind:'caution',amount:1000}],cautionAppliedRent:200,cautionReturned:800,cautionWithheld:200};
 assert.equal(reminderSummary([{path:'rentals/r',data:rental}],'2026-10-18').balances,0);
 assert.equal(reminderSummary([{path:'rentals/r',data:rental}],'2026-10-18').deposits,0);
 const unpaid={...rental,cautionAppliedRent:0,cautionReturned:700};
 const counts=reminderSummary([{path:'rentals/r',data:unpaid}],'2026-10-18');assert.equal(counts.balances,1);assert.equal(counts.deposits,1);
});
test('Tweede melding tijdens laden krijgt voorrang; accountwissel opent geen oud dossier',async()=>{
 const a=zandbak(scriptUit(leesHtml()));a.URLSearchParams=URLSearchParams;a.NOTIFICATION_READY=true;a.NOTIFICATION_BUSY=false;a.SBSES={user:{id:'a'}};a.sbKlaar=()=>true;a.location={hash:'#atlas=vehicle&id=first'};a.$=()=>null;a.CARS=[{id:'first'},{id:'last'}];a.reload=async()=>{};
 let release;const opened=[];let count=0;a.sbHaal=()=>++count===1?new Promise(r=>{release=r;}):Promise.resolve(true);a.openCar=c=>opened.push(c.id);
 const first=a.openNotificationTarget();a.location.hash='#atlas=vehicle&id=last';release(true);await first;await new Promise(r=>setTimeout(r,0));assert.deepEqual(opened,['last']);
 opened.length=0;a.sbHaal=async()=>{a.SBSES={user:{id:'b'}};return true;};let login=0;a.naarAanmelden=()=>login++;a.toast=()=>{};await a.openNotificationTarget();assert.equal(login,1);assert.deepEqual(opened,[]);
});
import {leesHtml,scriptUit,zandbak} from './atlas.mjs';
test('Instellingenrefresh bewaart lopende diagnose, account- of taalwissel vervangt paneel',()=>{
 const a=zandbak(scriptUit(leesHtml()));let current=null,created=0;
 a.sbKlaar=()=>true;a.SBSES={user:{id:'owner-a'}};
 a.$=id=>id==='phoneSettings'?current:{parentNode:{appendChild:p=>{current=p;}}};
 a.phonePanel=()=>({number:++created,textContent:'diagnose bezig',remove(){current=null;}});
 const first=a.mountPhoneSettings();assert.equal(created,1);assert.equal(a.mountPhoneSettings(),first);assert.equal(first.textContent,'diagnose bezig');
 a.SBSES={user:{id:'owner-b'}};assert.notEqual(a.mountPhoneSettings(),first);assert.equal(created,2);
 a.L='nl';a.mountPhoneSettings();assert.equal(created,3);
 a.sbKlaar=()=>false;a.mountPhoneSettings();assert.equal(created,4);
});
test('Iedere workerstap heeft een aflopende wachttijd, ook register/update/ready',async()=>{
 const a=zandbak(scriptUit(leesHtml()));let timeout,cleared=0;
 a.setTimeout=fn=>{timeout=fn;return 1;};a.clearTimeout=()=>cleared++;
 const waiting=a.phoneBound(new Promise(()=>{}));timeout();await assert.rejects(waiting,/worker-timeout/);
 assert.equal(await a.phoneBound(Promise.resolve('ok')),'ok');assert.equal(cleared,1);
 const source=leesHtml();assert.ok(source.includes("await phoneBound(navigator.serviceWorker.register('./push-sw.js'))"));assert.ok(source.includes('await phoneBound(reg.update())'));assert.ok(source.includes('await phoneBound(navigator.serviceWorker.ready)'));
});
test('Telefoonstart begeleidt iPhone, login en geweigerde toestemming afzonderlijk',()=>{
 const a=zandbak(scriptUit(leesHtml()));
 a.location={protocol:'https:'};a.navigator={userAgent:'iPhone',standalone:false,serviceWorker:{}};
 a.window.isSecureContext=true;a.window.PushManager={};a.window.Notification={};a.Notification={permission:'default'};
 a.window.matchMedia=()=>({matches:false});
 assert.equal(a.phoneStartState(),'install');
 a.navigator.standalone=true;a.sbKlaar=()=>false;assert.equal(a.phoneStartState(),'login');
 a.sbKlaar=()=>true;assert.equal(a.phoneStartState(),'ready');
 a.Notification.permission='denied';assert.equal(a.phoneStartState(),'denied');
 a.location.protocol='file:';assert.equal(a.phoneStartState(),'local');
 a.location.protocol='https:';a.navigator.userAgent='Desktop';delete a.window.PushManager;assert.equal(a.phoneStartState(),'unsupported');
 for(const lang of ['fr','nl','ar']){a.L=lang;assert.ok(a.phoneGuideText().install.includes('Safari'));assert.ok(a.phoneGuideText().start);}
});
test('Start vraagt toestemming vóór netwerk en plant na registratie automatisch test',()=>{
 const code=leesHtml();const flow=code.slice(code.indexOf("on.addEventListener('click',async function(){if(on.disabled)return;var state=phoneStartState()"),code.indexOf("test.addEventListener('click'",code.indexOf('function phonePanel()')));
 assert.ok(flow.indexOf('Notification.requestPermission()')>=0);
 assert.ok(flow.indexOf('Notification.requestPermission()')<flow.indexOf("phoneAPI('config')"));
 assert.ok(flow.indexOf("phoneAPI('subscribe'")<flow.indexOf("phoneAPI('test'"));
 assert.ok(flow.includes('guide.testError'));assert.ok(!flow.includes('requestPermission();status.textContent=tx.active'));
});
test('Eén bewuste tik registreert en plant test; fouten geven nooit valse ontvangst',async()=>{
 for(const scenario of ['success','denied','config-fails','test-fails']){
  const a=zandbak(scriptUit(leesHtml())),calls=[];
  a.el=(tag,cls,text)=>({tag,className:cls,textContent:text,children:[],handlers:{},appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(n,f){this.handlers[n]=f;}});
  a.sbKlaar=()=>true;a.location={protocol:'https:'};a.isSecureContext=true;a.PushManager={};a.atob=atob;
  a.Notification={permission:'default',requestPermission:async()=>{calls.push('permission');return scenario==='denied'?'denied':'granted';}};
  const sub={endpoint:'https://web.push.apple.com/test',toJSON(){return {endpoint:this.endpoint};}};
  a.navigator={userAgent:'iPhone',standalone:true,serviceWorker:{register:async()=>calls.push('worker'),ready:Promise.resolve({pushManager:{getSubscription:async()=>null,subscribe:async()=>sub}})}};
  a.phoneAPI=async(action)=>{calls.push(action);if(action==='config'&&scenario==='config-fails'||action==='test'&&scenario==='test-fails')throw Error('network');return action==='config'?{publicKey:'YQ'}:{};};
  const panel=a.phonePanel(),on=panel.children.find(x=>x.tag==='button'),status=panel.children[2],manage=panel.children.find(x=>x.tag==='details');
  assert.deepEqual(calls,[]);await on.handlers.click();assert.equal(calls[0],'permission');assert.equal(on.disabled,false);
  if(scenario==='success'){assert.deepEqual(calls,['permission','config','worker','subscribe','test']);assert.equal(status.textContent,a.phoneText().sent);assert.equal(on.hidden,true);assert.equal(manage.hidden,false);}
  if(scenario==='denied'){assert.deepEqual(calls,['permission']);assert.equal(status.textContent,a.phoneText().denied);assert.ok(!on.hidden);}
  if(scenario==='config-fails'){assert.deepEqual(calls,['permission','config']);assert.equal(status.textContent,a.phoneGuideText().error);assert.ok(!on.hidden);}
  if(scenario==='test-fails'){assert.equal(status.textContent,a.phoneGuideText().testError);assert.equal(manage.open,true);assert.equal(on.hidden,true);}
 }
});
test('Achtergrondcontrole telt tijd- en geldrisico’s zonder persoonsgegevens',()=>{
 const rows=[
  {path:'vehicles/c',data:{km:119500,maintenance:[{dueKm:120000},{dueKm:130000},{dueKm:1,completedAt:'2026-01-01'}],insuranceUntil:'2026-10-18',inspectionUntil:'2026-13-01'}},
  {path:'clients/ready',data:{docNumber:'AA1',licenceNumber:'L1'}},
  {path:'rentals/late',data:{clientName:'SECRET NAME',depart:{},to:'2026-10-16',from:'2026-10-10',total:600,payments:[{kind:'rent',amount:600}]}},
  {path:'rentals/back',data:{clientId:'ready',depart:{},retour:{},from:'2026-10-10',to:'2026-10-12',limit:'2026-10-17',caution:3000,payments:[{kind:'rent',amount:500},{kind:'caution',amount:3000}],total:500}},
  {path:'rentals/start',data:{clientId:'missing',from:'2026-10-17',to:'2026-10-20',total:900,payments:[]}},
  {path:'rentals/done',data:{depart:{},retour:{},released:true,from:'2026-10-10',to:'2026-10-12',limit:'2026-10-14',total:400,payments:[{kind:'rent',amount:400},{kind:'caution',amount:2000}],cautionReturned:2000}}
 ];
 const counts=reminderSummary(rows,'2026-10-17');assert.deepEqual(counts,{maintenance:1,documents:1,late:1,departures:1,dossiers:1,balances:1,deposits:1,warranties:0});
 for(const l of ['fr','nl','ar'])assert.ok(!JSON.stringify(summaryPayload(counts,l)).includes('SECRET'));
 assert.equal(summaryPayload({maintenance:0,documents:0,late:0,departures:0,dossiers:0,balances:0,deposits:0}),null);
 // Use historical dates: future Morocco offset predictions differ between ICU/tzdata releases.
 // Test both the ordinary UTC+1 boundary and the Ramadan UTC+0 exception.
 assert.equal(localDay(new Date('2025-01-15T23:30:00Z')),'2025-01-16');
 assert.equal(localDay(new Date('2025-03-15T23:30:00Z')),'2025-03-15');
});
test('Pushabonnementen accepteren geen willekeurige servers of ongeldige sleutels',()=>{
 const s={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'a'.repeat(87),auth:'a'.repeat(22)}};
 assert.equal(validSubscription(s),true);
 for(const endpoint of ['http://fcm.googleapis.com/test','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x'])assert.equal(validSubscription({...s,endpoint}),false);
 assert.equal(validSubscription({...s,keys:{}}),false);
});
test('Serviceworker toont ontvangen push zonder open app en opent alleen eigen scope',async()=>{
 const handlers={},notifications=[],opened=[];let pending;
 const scope='https://example.test/atlas/';
 const self={registration:{scope,showNotification:async(...a)=>notifications.push(a)},addEventListener:(n,f)=>handlers[n]=f,clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 const context={self,URL};vm.createContext(context);vm.runInContext(readFileSync(new URL('../push-sw.js',import.meta.url),'utf8'),context);
 handlers.push({data:{json:()=>({body:'Test',url:'https://evil.test/',tag:'t'})},waitUntil:p=>pending=p});await pending;
 assert.equal(notifications[0][0],'Atlas');assert.equal(notifications[0][1].body,'Test');
 assert.equal(notifications[0][1].data.url,scope);
 handlers.notificationclick({notification:{close(){},data:{url:'https://evil.test/'}},waitUntil:p=>pending=p});await pending;
 assert.deepEqual(opened,[scope]);
});
test('iPhone-klik bewaart bestemming en stuurt haar ook bij mislukte navigatie naar open app',async()=>{
 const handlers={},messages=[];let pending,saved,focused=false;
 const scope='https://example.test/atlas/',url=scope+'#atlas=vehicle&id=c1&section=documents';
 const win={url:scope,navigate:async()=>{throw Error('iOS navigation');},postMessage:m=>messages.push(m),focus:async()=>{focused=true;}};
 const self={registration:{scope},addEventListener:(n,f)=>handlers[n]=f,clients:{matchAll:async()=>[win]}};
 const ctx={self,URL,Date};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../push-sw.js',import.meta.url),'utf8'),ctx);ctx.atlasPushTarget=async value=>{saved=value;};
 handlers.notificationclick({notification:{close(){},data:{url}},waitUntil:p=>pending=p});await pending;
 assert.equal(saved.url,url);assert.equal(messages[0].url,url);assert.equal(messages[0].type,'atlas-open-target');assert.equal(focused,true);
});
test('Ontvangstdiagnose onderscheidt push, lokale test en weergavefout zonder persoonsgegevens',async()=>{
 const handlers={},notes=[];let pending,receipt=null,fail=false;
 const self={registration:{scope:'https://example.test/',showNotification:async(...args)=>{if(fail)throw Object.assign(Error(),{name:'NotAllowedError'});notes.push(args);}},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:async()=>{}};
 const ctx={self,URL,Date};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../push-sw.js',import.meta.url),'utf8'),ctx);
 ctx.atlasPushReceipt=async value=>{if(value)receipt=value;return receipt;};
 const answers=[];handlers.message({data:{type:'atlas-push-health',local:true},ports:[{postMessage:x=>answers.push(x)}],waitUntil:p=>pending=p});await pending;
 assert.equal(answers[0].local,'accepted');assert.equal(answers[0].receipt,null);assert.ok(notes[0][0].includes('Diagnostic'));
 handlers.push({data:{json:()=>({body:'PRIVATE CLIENT'})},waitUntil:p=>pending=p});await pending;
 assert.equal(receipt.state,'display-request-accepted');assert.ok(!JSON.stringify(receipt).includes('PRIVATE'));
 fail=true;handlers.push({data:{json:()=>({})},waitUntil:p=>pending=p});await assert.rejects(pending);
 assert.equal(receipt.state,'display-error');assert.equal(receipt.error,'NotAllowedError');
 handlers.message({data:{type:'atlas-push-health',local:false},ports:[{postMessage:x=>answers.push(x)}],waitUntil:p=>pending=p});await pending;
 assert.equal(answers[1].local,'not-tested');assert.equal(notes.length,2);
});
test('Push display never waits for diagnostic storage; three examples retain distinct titles and tags',async()=>{
 const handlers={},notes=[],writes=[];const self={registration:{scope:'https://example.test/',showNotification:async(title,options)=>{notes.push({title,...options});}},addEventListener:(name,fn)=>handlers[name]=fn};
 const ctx={self,URL,Date};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../push-sw.js',import.meta.url),'utf8'),ctx);
 ctx.atlasPushReceipt=value=>{writes.push(value);return new Promise(()=>{});};
 for(let i=0;i<3;i++){handlers.push({data:{json:()=>({title:'Atlas TEST '+i,tag:'example-'+i,body:'FICTITIOUS',url:'./#atlas=alerts'})},waitUntil(){}});}
 await Promise.resolve();assert.equal(notes.length,3);assert.equal(new Set(notes.map(x=>x.tag)).size,3);assert.equal(new Set(notes.map(x=>x.title)).size,3);
});
test('Visuele auto: ontbrekende beoordeling nooit groen, urgentste taak bepaalt kleur',()=>{
 const a=zandbak(scriptUit(leesHtml()));
 const c={km:120000,maintenance:[{part:'engine',dueKm:130000},{part:'engine',dueKm:120000},{part:'tires',dueKm:1,completedAt:'2026-10-01'}]};
 assert.equal(a.vehiclePartState(c,'engine').status,'overdue');
 assert.equal(a.vehiclePartState(c,'tires').status,'unknown');
 assert.equal(a.vehiclePartState(c,'battery').tasks.length,0);
});
test('Telefoonaanroep houdt publieke gateway-JWT en echte gebruiker gescheiden',async()=>{
 const a=zandbak(scriptUit(leesHtml())),calls=[];
 a.AbortController=AbortController;
 a.SB={url:'https://mimpyfbitoiotxuqoymj.supabase.co',key:'public-key'};
 a.SBSES={access_token:'user-es256-token'};
 a.fetch=async(url,opt)=>{calls.push(opt);return {ok:true,status:200,json:async()=>({registered:true})};};
 assert.equal((await a.phoneAPI('status',{endpoint:'test'})).registered,true);
 assert.equal(calls[0].headers['x-atlas-user-token'],'user-es256-token');
 assert.ok(calls[0].headers.Authorization.startsWith('Bearer eyJ'));
 assert.ok(!calls[0].headers.Authorization.includes('user-es256-token'));
 assert.ok(!calls[0].body.includes('user-es256-token'));
});
