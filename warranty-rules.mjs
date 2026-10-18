const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function warrantyStatus(car,w,day){
  if(w.claim?.status==='open')return 'claim';
  if(w.claim?.status==='closed')return 'closed';
  const hasDate=dateOK(w.until),hasKm=Number(w.untilKm)>0;
  if(!hasDate&&!hasKm)return 'unknown';
  const knownKm=car.km!==''&&car.km!==null&&car.km!==undefined&&Number.isFinite(Number(car.km));
  if(hasDate&&w.until<day||hasKm&&knownKm&&Number(car.km)>Number(w.untilKm))return 'expired';
  if(hasKm&&!knownKm)return 'unknown';
  if(hasDate&&(Date.parse(w.until)-Date.parse(day))/86400000<=30||hasKm&&Number(w.untilKm)-Number(car.km)<=1000)return 'soon';
  return 'active';
}
export function warrantyValid(w){
  return !!(String(w.label||'').trim()&&String(w.supplier||'').trim()&&dateOK(w.purchased)&&
    (dateOK(w.until)||Number.isInteger(Number(w.untilKm))&&Number(w.untilKm)>0)&&
    (!w.until||dateOK(w.until)&&w.until>=w.purchased)&&
    (w.untilKm==null||w.untilKm===''||Number.isInteger(Number(w.untilKm))&&Number(w.untilKm)>0)&&
    (w.amount==null||w.amount===''||Number.isFinite(Number(w.amount))&&Number(w.amount)>=0));
}
