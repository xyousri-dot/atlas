import {test} from 'node:test';
import assert from 'node:assert/strict';
import {leesHtml,scriptUit,zandbak} from './atlas.mjs';
const ctx=()=>zandbak(scriptUit(leesHtml()));
function fleet(a){
 a.CARS=[{id:'c',model:'TEST',km:100,insuranceUntil:'2030-01-01',inspectionUntil:'2030-01-01',vignetteUntil:'2030-01-01'}];
 a.CLIENTS=[{id:'p',docNumber:'TEST123',licenceNumber:'TEST456',docExpiry:'2030-01-01',licenceExpiry:'2030-01-01'}];
 a.RENTALS=[{id:'r',vehicleId:'c',clientId:'p',clientName:'TEST CLIENT',from:'2026-10-17',to:'2026-10-20',total:100,caution:50,payments:[{kind:'rent',amount:100},{kind:'caution',amount:50}]}];
}
test('Bedrijfsbewaking: volledig dossier zonder risico, ontbrekend document wordt zichtbaar',()=>{
 const a=ctx();fleet(a);assert.equal(a.businessRisks('2026-10-17').length,0);
 a.CLIENTS[0].docNumber='';assert.ok(a.businessRisks('2026-10-17').some(x=>x.action==='client'));
});
test('Bedrijfsbewaking: verloopt tijdens huur, botsing, onbetaald en ontbrekende borg',()=>{
 const a=ctx();fleet(a);a.CLIENTS[0].licenceExpiry='2026-10-18';a.CARS[0].insuranceUntil='2026-10-19';
 a.RENTALS[0].payments=[];a.RENTALS.push({...a.RENTALS[0],id:'r2'});
 const out=a.businessRisks('2026-10-17');
 assert.ok(out.some(x=>x.action==='client'&&x.urgent));assert.ok(out.some(x=>x.action==='car'));
 assert.equal(out.filter(x=>x.action==='contract').length,1,'één conflictwaarschuwing per auto');
 assert.equal(out.filter(x=>x.action==='pay').length,4,'huur en borg per dossier apart');
});
test('Bedrijfsbewaking negeert geannuleerd, teruggebracht en verre toekomst',()=>{
 const a=ctx();fleet(a);a.RENTALS[0].payments=[];
 a.RENTALS[0].cancelled=true;assert.equal(a.businessRisks('2026-10-17').length,0);
 a.RENTALS[0].cancelled=false;a.RENTALS[0].retour={};assert.equal(a.businessRisks('2026-10-17').length,0);
 delete a.RENTALS[0].retour;a.RENTALS[0].from='2027-01-01';a.RENTALS[0].to='2027-01-03';assert.equal(a.businessRisks('2026-10-17').length,0);
});
test('Onderhoud: kilometergrens en datum, de eerste grens telt',()=>{
 const a=ctx(),t={dueKm:120000,dueDate:'2027-01-01'};
 assert.equal(a.maintenanceStatus({km:118999},t,'2026-10-17').status,'planned');
 assert.equal(a.maintenanceStatus({km:119000},t,'2026-10-17').status,'soon');
 assert.equal(a.maintenanceStatus({km:120000},t,'2026-10-17').status,'overdue');
 assert.equal(a.maintenanceStatus({km:100000},t,'2027-01-01').status,'overdue');
 assert.equal(a.maintenanceStatus({km:100000},t,'2026-12-02').status,'soon');
});
test('Alleen datum of kilometers is voldoende; onbekend is nooit stilzwijgend veilig',()=>{
 const a=ctx();
 assert.equal(a.maintenanceStatus({}, {dueKm:120000},'2026-10-17').status,'unknown');
 assert.equal(a.maintenanceStatus({km:''}, {dueKm:120000},'2026-10-17').status,'unknown');
 assert.equal(a.maintenanceStatus({km:0}, {dueKm:120000},'2026-10-17').status,'planned');
 assert.equal(a.maintenanceStatus({}, {dueDate:'2026-10-18'},'2026-10-17').status,'soon');
 assert.equal(a.maintenanceStatus({}, {dueDate:'2026-02-30'},'2026-10-17').status,'unknown');
});
test('Afgerond onderhoud blijft historie, geen actieve waarschuwing of betaling',()=>{
 const a=ctx(),task={label:'Courroie',dueKm:120000},car={km:120001,maintenance:[task]};
 assert.equal(a.maintenanceAlerts([car],'2026-10-17').length,1);
 task.completedAt='2026-10-17';
 assert.equal(a.maintenanceAlerts([car],'2026-10-17').length,0);
 assert.equal(a.maintenanceStatus(car,task).status,'done');
 assert.equal(task.dueKm,120000);assert.equal(task.payments,undefined);
});
test('Kilometerstand uit retour laat waarschuwing vanzelf verschijnen en urgent komt eerst',()=>{
 const a=ctx(),c={km:118000,maintenance:[{label:'Riem',dueKm:120000},{label:'Olie',dueDate:'2026-10-01'}]};
 assert.equal(a.maintenanceAlerts([c],'2026-10-17').length,1);
 c.km=119500;const alerts=a.maintenanceAlerts([c],'2026-10-17');
 assert.equal(alerts.length,2);assert.equal(alerts[0].task.label,'Olie');
});
test('Onderhoudsteksten zijn aanwezig in de drie talen',()=>{
 const a=ctx();for(const l of ['fr','nl','ar']){a.L=l;const t=a.maintenanceText();assert.ok(t.title&&t.help&&t.confirm);assert.equal(t.types.length,6);}
});
