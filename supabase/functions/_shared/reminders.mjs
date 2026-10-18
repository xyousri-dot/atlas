export function localDay(now=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
export function reminderSummary(rows,day=localDay()) {
  const counts={maintenance:0,documents:0,late:0};
  const days=d=>Math.round((Date.parse(d)-Date.parse(day))/86400000);
  for(const {path,data:c} of rows){
    if(path.startsWith('vehicles/')){
      for(const t of c.maintenance||[]){
        if(t.completedAt)continue;
        const kmKnown=c.km!==null&&c.km!==''&&Number.isFinite(Number(c.km));
        if((Number(t.dueKm)>0&&kmKnown&&Number(t.dueKm)-Number(c.km)<=1000)||(validDate(t.dueDate)&&days(t.dueDate)<=30))counts.maintenance++;
      }
      for(const key of ['insuranceUntil','inspectionUntil','vignetteUntil'])if(validDate(c[key])&&days(c[key])<=30)counts.documents++;
    }
    if(path.startsWith('rentals/')&&!c.cancelled&&c.depart&&!c.retour&&validDate(c.to)&&c.to<day)counts.late++;
  }
  return counts;
}
export function summaryPayload(counts,language='fr') {
  const total=Object.values(counts).reduce((a,n)=>a+n,0);
  if(!total)return null;
  const body=({fr:`${total} point(s) à vérifier : entretien ${counts.maintenance}, documents ${counts.documents}, retours en retard ${counts.late}. Ouvrez Atlas.`,nl:`${total} aandachtspunt(en): onderhoud ${counts.maintenance}, documenten ${counts.documents}, te late retouren ${counts.late}. Open Atlas.`,ar:`${total} تنبيه: صيانة ${counts.maintenance}، وثائق ${counts.documents}، تأخر ${counts.late}. افتح Atlas.`})[language]||`${total} rappel(s). Ouvrez Atlas.`;
  return {body,tag:'atlas-daily',url:'./'};
}
export function validSubscription(s){
  try{
    const u=new URL(s.endpoint);
    const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
    return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&hosts.includes(u.hostname)&&u.href.length<2048&&/^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(s.keys.auth);
  }catch{return false;}
}
