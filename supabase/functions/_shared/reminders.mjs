export function localDay(now=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
export function reminderSummary(rows,day=localDay()) {
  const counts={maintenance:0,documents:0,late:0,departures:0,dossiers:0,balances:0,deposits:0};
  const days=d=>Math.round((Date.parse(d)-Date.parse(day))/86400000);
  const clients=new Map(rows.filter(r=>r.path.startsWith('clients/')).map(r=>[r.path.slice(8),r.data||{}]));
  for(const {path,data:c} of rows){
    if(path.startsWith('vehicles/')){
      for(const t of c.maintenance||[]){
        if(t.completedAt)continue;
        const kmKnown=c.km!==null&&c.km!==''&&Number.isFinite(Number(c.km));
        if((Number(t.dueKm)>0&&kmKnown&&Number(t.dueKm)-Number(c.km)<=1000)||(validDate(t.dueDate)&&days(t.dueDate)<=30))counts.maintenance++;
      }
      for(const key of ['insuranceUntil','inspectionUntil','vignetteUntil'])if(validDate(c[key])&&days(c[key])<=30)counts.documents++;
    }
    if(path.startsWith('rentals/')&&!c.cancelled){
      if(c.depart&&!c.retour&&validDate(c.to)&&c.to<day)counts.late++;
      if(!c.depart&&!c.retour&&validDate(c.from)&&c.from<=day){
        counts.departures++;
        const client=clients.get(c.clientId)||{};
        if(!client.docNumber||!client.licenceNumber)counts.dossiers++;
      }
      const rentPaid=(c.payments||[]).filter(p=>p.kind==='rent').reduce((sum,p)=>sum+Number(p.amount||0),0);
      if(validDate(c.from)&&c.from<=day&&Number(c.total||0)>rentPaid)counts.balances++;
      const cautionPaid=(c.payments||[]).filter(p=>p.kind==='caution').reduce((sum,p)=>sum+Number(p.amount||0),0);
      const cautionClosed=Number(c.cautionReturned||0)+Number(c.cautionHeld||0);
      if(c.retour&&!c.released&&validDate(c.limit)&&c.limit<=day&&cautionPaid>cautionClosed)counts.deposits++;
    }
  }
  return counts;
}
export function summaryPayload(counts,language='fr') {
  const total=Object.values(counts).reduce((a,n)=>a+n,0);
  if(!total)return null;
  const body=({
    fr:`${total} point(s) : départs ${counts.departures}, dossiers ${counts.dossiers}, paiements ${counts.balances}, cautions ${counts.deposits}, entretien ${counts.maintenance}, documents ${counts.documents}, retards ${counts.late}.`,
    nl:`${total} punten: vertrek ${counts.departures}, dossiers ${counts.dossiers}, betalingen ${counts.balances}, borgen ${counts.deposits}, onderhoud ${counts.maintenance}, documenten ${counts.documents}, te laat ${counts.late}.`,
    ar:`${total} تنبيه: تسليم ${counts.departures}، ملفات ${counts.dossiers}، دفعات ${counts.balances}، ضمانات ${counts.deposits}، صيانة ${counts.maintenance}، وثائق ${counts.documents}، تأخير ${counts.late}.`
  })[language]||`${total} rappel(s). Ouvrez Atlas.`;
  return {body,tag:'atlas-daily',url:'./'};
}
export function validSubscription(s){
  try{
    const u=new URL(s.endpoint);
    const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
    return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&hosts.includes(u.hostname)&&u.href.length<2048&&/^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(s.keys.auth);
  }catch{return false;}
}
