import {test} from 'node:test';
import assert from 'node:assert/strict';
import {leesHtml,scriptUit,zandbak} from './atlas.mjs';
const context=()=>zandbak(scriptUit(leesHtml()));

function betaalDom(a){
  a.dShort=()=>'';
  const nodes=[];
  function node(tag,cls,text){const n={tag,children:[],textContent:text||'',style:{},value:'',events:{},appendChild(x){this.children.push(x);return x;},addEventListener(k,f){this.events[k]=f;},setAttribute(){},focus(){}};nodes.push(n);return n;}
  a.el=node;a.document={createElement:tag=>node(tag)};return nodes;
}
test('Volledig betaald toont bevestiging zonder nieuw betaalformulier',()=>{
  const a=context(),nodes=betaalDom(a);
  a.payPanel({total:1650,caution:5000,payments:[{kind:'rent',amount:1650},{kind:'caution',amount:5000}]});
  assert.ok(nodes.some(n=>n.textContent===a.paymentText().paid));
  assert.ok(nodes.some(n=>n.textContent===a.paymentText().deposit));
  assert.equal(nodes.filter(n=>n.tag==='input').length,0);
});
test('Extra kosten maken uitsluitend een extra betaling mogelijk; deelbetaling laat juiste saldo staan',()=>{
  const a=context();
  const r={total:1650,caution:5000,retour:{},charges:[{amount:200}],payments:[{kind:'rent',amount:1650},{kind:'caution',amount:5000},{kind:'extra',amount:50}]};
  assert.deepEqual(Array.from(a.paymentKindsDue(r)),['extra']);
  assert.equal(a.paymentDue(r,'extra'),150);assert.equal(a.teBetalen(r),150);
  const nodes=betaalDom(a);a.betaalVerzoek=()=>a.el('div');a.payPanel(r);
  assert.deepEqual(nodes.filter(n=>n.tag==='option'&&['rent','extra','caution'].includes(n.value)).map(n=>n.value),['extra']);
  assert.equal(nodes.find(n=>n.tag==='input').value,'150');
  r.payments.push({kind:'extra',amount:150});assert.equal(a.paymentKindsDue(r).length,0);
});
test('Een inmiddels betaalde post kan niet nogmaals worden geboekt',async()=>{
  const a=context(),nodes=betaalDom(a),r={id:'r',total:100,caution:0,payments:[]};
  a.betaalVerzoek=()=>a.el('div');a.toast=()=>{};let writes=0;
  a.S={get:async()=>({...r,payments:[{kind:'rent',amount:100}]}),set:async()=>{writes++;}};
  a.payPanel(r);const go=nodes.find(n=>n.tag==='button'&&n.textContent===a.T().payAdd);
  nodes.find(n=>n.tag==='input').value='100';
  await go.events.click();assert.equal(writes,0);assert.equal(go.disabled,false);
});

test('Alle negen scancorrecties blijven in het bronformulier bewaard voor een volgende scan',()=>{
  const a=context(),nodes={};
  a.$=id=>nodes[id]||(nodes[id]={value:'',hidden:true,checked:true});
  a.markKlantKlaarBasis=()=>{};
  a.SNELKLANT={docType:'cin'};
  const waarden={name:'AMINE EL FASSI',docNumber:'AB123456',birth:'1990-02-15',docExpiry:'2030-01-01',nationality:'MAR',address:'12 Rue Atlas Rabat',licenceNumber:'12/123456',licenceIssue:'2010-01-01',licenceExpiry:'2030-02-01'};
  for(const [k,v] of Object.entries(waarden)) a.ctlZet(k,v);
  const opnieuw=a.klantUitFormulier();
  for(const [k,v] of Object.entries(waarden)) {
    assert.equal(opnieuw[k],v,k+' in volgende scan');
    assert.equal(a.SNELKLANT[k],v,k+' in huidige scan');
  }
  assert.equal(nodes.nwName.value,waarden.name);
  assert.equal(nodes.scanReviewed.checked,false);
});

test('Reservering → vertrek → retour → afrekening, met huur en borg apart',()=>{
  const a=context(),r={id:'r',total:600,caution:1000,payments:[]};
  assert.equal(a.stepOf(r),1);
  r.depart={km:100}; assert.equal(a.stepOf(r),2);
  r.retour={km:200}; assert.equal(a.stepOf(r),3);
  assert.equal(a.dueCaution(r),0,'na retour geen nieuwe borg eisen');
  r.payments.push({kind:'rent',amount:600},{kind:'caution',amount:500});
  assert.equal(a.stepOf(r),3,'alleen daadwerkelijk ontvangen borg afhandelen');
  r.released=true;r.cautionReturned=500;
  assert.equal(a.stepOf(r),4);
});

test('Extra kosten en extra betalingen lossen geen huurschuld af',()=>{
  const a=context(),r={total:600,caution:0,depart:{},retour:{},charges:[{amount:150}],payments:[{kind:'rent',amount:400},{kind:'extra',amount:100}]};
  assert.equal(a.paidRent(r),400);assert.equal(a.dueRent(r),200);
  assert.equal(a.dueExtras(r),50);assert.equal(a.stepOf(r),3);
  r.payments.push({kind:'rent',amount:200},{kind:'extra',amount:50});
  assert.equal(a.stepOf(r),4);
});

test('Zonder ontvangen borg hoeft een betaalde retour niet op borg te wachten',()=>{
  const a=context(),r={total:600,caution:1000,depart:{},retour:{},payments:[{kind:'rent',amount:600}]};
  assert.equal(a.stepOf(r),4);assert.equal(a.paidCaution(r),0);
});

test('Nieuwe boeking boekt standaard geen ontvangst',()=>{
  const a=context();assert.equal(a.NWBETAAL,'later');
  assert.equal(a.betalingenVoorNieuw(600,1000).length,0);
  a.NWBETAAL='transfer';assert.equal(a.betalingenVoorNieuw(600,1000).length,0);
  a.NWBETAAL='cash';assert.equal(a.betalingenVoorNieuw(600,1000).length,2);
});

test('Scandatums: kalenderfouten, verlopen documenten en jonge klant worden gemarkeerd',()=>{
  const a=context();
  for(const v of ['2026-02-30','2025-02-29','2026-13-01','not-a-date']) assert.equal(a.echteDatum(v),false,v);
  assert.equal(a.echteDatum('2024-02-29'),true);
  assert.equal(a.ctlOordeel('docExpiry','2026-02-30').s,'bad');
  assert.equal(a.ctlOordeel('licenceExpiry','2026-10-01').s,'bad');
  assert.equal(a.ctlOordeel('birth','2015-01-01').s,'bad');
  assert.equal(a.ctlOordeel('licenceExpiry','2030-01-01').s,'ok');
});

test('Nieuwe of gewijzigde scan vereist opnieuw menselijke controle',()=>{
  const a=context();a.SNELKLANT={name:'TEST DRIVER',docNumber:'AB123456',docType:'cin'};
  assert.equal(a.scanBevestigd(),false);
  a.SCANBEVESTIGD=a.scanSnapshot();assert.equal(a.scanBevestigd(),true);
  a.SNELKLANT.docNumber='AB123457';assert.equal(a.scanBevestigd(),false);
  a.SCANBEVESTIGD=a.scanSnapshot();a.ctlZet('docNumber','AB123458');assert.equal(a.scanBevestigd(),false);
});

test('Borg verrekenen boekt geen tweede geldontvangst en houdt huur en extra apart',()=>{
  const a=context(),r={total:600,caution:1000,depart:{},retour:{},charges:[{amount:150}],payments:[{kind:'rent',amount:500},{kind:'caution',amount:1000}]};
  const patch=a.settlementPatch(r,750,'Huur 100 + brandstof 150','transfer',true);
  assert.equal(patch.cautionAppliedRent,100);assert.equal(patch.cautionAppliedExtras,150);
  Object.assign(r,patch);a.RENTALS=[r];
  assert.equal(a.dueRent(r),0);assert.equal(a.dueExtras(r),0);assert.equal(a.stepOf(r),4);
  assert.equal(r.payments.length,2);
  const refunds=a.cashMoves(a.today()).filter(x=>x.kind==='refund');
  assert.equal(refunds.length,1);assert.equal(refunds[0].amount,750);assert.equal(refunds[0].method,'transfer');
});

test('Inhouding zonder verrekening wist de schuld niet',()=>{
  const a=context(),r={total:600,caution:1000,depart:{},retour:{},payments:[{kind:'caution',amount:1000}]};
  Object.assign(r,a.settlementPatch(r,500,'Schade apart','cash',false));
  assert.equal(a.dueRent(r),600);assert.equal(a.stepOf(r),3);
});

test('Scannerfout blokkeert het volgende contract niet',async()=>{
  const a=context();a.SNELBEZIG=null;a.snelScanZonderControle=async()=>{a.SNELBEZIG=Promise.resolve();throw new Error('unreadable image');};
  await a.snelScan([{}],'auto');assert.equal(a.SNELBEZIG,null);assert.equal(a.SCANBEVESTIGD,'');
});

test('Compact formulier blijft geblokkeerd zonder volledige vertrekcontrole',async()=>{
  const a=context();let writes=0;a.S.set=async()=>{writes++;};
  a.rental={id:'r',vehicleId:'c',from:'2026-10-02',to:'2026-10-04'};
  a.draft={marks:[],shots:{},km:'100',fuel:'100',noDmg:true,sig:null};
  a.kmStapOk=()=>true;
  await a.finishHandover();assert.equal(writes,0,'handtekening ontbreekt');
  a.draft.sig='test';a.draft.noDmg=false;
  await a.finishHandover();assert.equal(writes,0,'voertuigstaat niet bevestigd');
});

test('Drie hoofdfasen zijn beschikbaar in Frans, Nederlands en Arabisch',()=>{
  const a=context();for(const l of ['fr','nl','ar']){a.L=l;assert.equal(a.simpleText().phases.length,3);assert.ok(a.simpleText().toSettlement);}
});

test('Opslaan van voorbereiding opent direct vertrek zonder asynchrone terugnavigatie',async()=>{
  const a=context(),store={};
  const values={nwFrom:'2026-10-02',nwTo:'2026-10-04',nwTotal:'200',nwCaution:'0',nwCar:'c',nwClient:'k'};
  a.$=id=>id in values?{value:values[id]}:null;
  a.CARS=[{id:'c',rate:100}];a.CLIENTS=[{id:'k',name:'TEST DRIVER'}];
  a.SNELKLANT=null;a.SNELBEZIG=null;a.editRental=null;a.NWSTAP=4;a.NWBETAAL='later';
  a.S.set=async(p,d)=>{store[p]=d;};
  a.reload=async()=>{a.RENTALS=Object.entries(store).filter(([p])=>p.startsWith('rentals/')).map(([p,d])=>({...d,id:p.split('/')[1]}));};
  let opened=0;a.openForm=(r,kind)=>{opened++;assert.equal(kind,'depart');assert.equal(r.depart,null);};
  a.render=()=>{};a.toast=()=>{};a.history.go=()=>{throw new Error('unexpected async history navigation');};
  await a.saveRentalEcht();assert.equal(opened,1);assert.equal(a.RENTALS.length,1);
  assert.equal(a.RENTALS[0].payments.length,0);
});
