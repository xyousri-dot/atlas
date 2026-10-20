/* Paid primary, one bounded attempt, then the offline reserve. */
(function(){
 if(!/(manikkusokwysmdfhxtu|mimpyfbitoiotxuqoymj)/.test(SBSTANDAARD.url)||location.protocol==='file:')return;
 window.ATLAS_AI_SCAN_ENABLED=true;
 const prepared=new WeakMap();
 /* Keep enough detail for small document text without making Anthropic resize a
    multi-megapixel phone photo again. That server-side resize only adds delay. */
 fotoVoorAI=async function(f){
  if(prepared.has(f))return prepared.get(f);
  const result=(async()=>{
  const img=await laadBeeld(f),maxSide=1500,maxPixels=1100000;
  const scale=Math.min(1,maxSide/Math.max(img.width,img.height),Math.sqrt(maxPixels/(img.width*img.height)));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let data='';for(const quality of [.93,.89,.85,.81,.78]){data=canvas.toDataURL('image/jpeg',quality).split(',')[1];if(data.length<=1320000)break;}
  return data;
  })();prepared.set(f,result);try{return await result;}catch(e){prepared.delete(f);throw e;}
 };
 let paidAttempts=0;
 aiLees=async function(files){
  AIFOUT='';window.ATLAS_PAID_SCAN_OK=false;window.ATLAS_SCAN_CONFLICT=false;
  if(!navigator.onLine){AIFOUT='offline';return null;}if(!sbKlaar()){AIFOUT='uit';return null;}
  if(!files?.length||files.length>6){AIFOUT='aantal';return null;}
  if(paidAttempts>=1){if(!window.ATLAS_PAID_SCAN_OK)AIFOUT='retry-limit';return null;}paidAttempts++;
  try{
   const fotos=await Promise.all(Array.from(files,f=>fotoVoorAI(f).then(data=>({type:'image/jpeg',data}))));
   const stop=new AbortController(),timer=setTimeout(()=>stop.abort(),25000);let response;
   try{response=await fetch(sbBasis()+'/functions/v1/atlas-scan',{method:'POST',headers:{apikey:SB.key,Authorization:'Bearer '+SBSES.access_token,'x-atlas-user-token':SBSES.access_token,'Content-Type':'application/json'},body:JSON.stringify({fotos,requestId:crypto.randomUUID()}),signal:stop.signal});}finally{clearTimeout(timer);}
   if(!response.ok){AIFOUT=String(response.status);if(SBSTANDAARD.url.includes('manikkusokwysmdfhxtu')){const detail=await response.json().catch(()=>({}));const code=String(detail.error||'').replace(/[^a-z-]/g,'').slice(0,40);if(code)AIFOUT+=' '+code;if(Number.isInteger(detail.providerStatus))AIFOUT+=' '+detail.providerStatus;}if(response.status===409){window.ATLAS_SCAN_CONFLICT=true;return {fotos:[],identityConflict:true};}return null;}
   const j=await response.json();if(!j||!Array.isArray(j.fotos)){AIFOUT='leeg';return null;}window.ATLAS_PAID_SCAN_OK=true;return j;
  }catch{AIFOUT='net';return null;}
 };
 const scanBase=snelScan;
 snelScan=async function(){if(SCAN_RUNNING)return;paidAttempts=0;const result=await scanBase.apply(this,arguments);if(window.ATLAS_SCAN_CONFLICT)scanQualityNotice(({fr:'Documents contradictoires : scannez une seule personne à la fois.',nl:'Tegenstrijdige documenten: scan één persoon tegelijk.',ar:'وثائق متعارضة. امسح وثائق شخص واحد فقط.'})[L]);return result;};
 const fillBase=aiVul;
 aiVul=async function(j,files){if(j?.identityConflict){scanQualityNotice(({fr:'Documents contradictoires : scannez une seule personne à la fois.',nl:'Tegenstrijdige documenten: scan één persoon tegelijk.',ar:'وثائق متعارضة. امسح وثائق شخص واحد فقط.'})[L]);return {iets:true,twijfelDoc:true,twijfelLic:true};}
  /* The guided slots are stronger evidence than model classification. This also
     maps a licence number returned in the generic document fields into the
     licence fields, so a saved iPhone photo cannot silently disappear. */
  if(j?.fotos&&files)j.fotos.forEach(p=>{const hint=files[p.foto]?.atlasScanHint;if(!hint)return;p.soort=hint;if(hint.startsWith('rijbewijs_')){if(!p.rijbewijs_nummer)p.rijbewijs_nummer=p.document_nummer||'';if(!p.rijbewijs_geldig_tot)p.rijbewijs_geldig_tot=p.geldig_tot||'';}});
  // The base reader may prefer the reverse side. Complete its empty fields
  // from the matching side, without overwriting disagreements or other IDs.
  const identityPhotos=(j?.fotos||[]).filter(p=>/^id_/.test(p.soort));
  for(const photo of identityPhotos)for(const other of identityPhotos){
   if(!photo.document_nummer||!other.document_nummer||photo.document_nummer!==other.document_nummer)continue;
   for(const field of ['achternaam','voornamen','geboortedatum','geldig_tot','land','nationaliteit','adres'])if(!photo[field]&&other[field])photo[field]=other[field];
  }
  const result=await fillBase(j,files);
  // A licence-only scan may contain usable dates and a printed name even when
  // its number is unreadable. Preserve existing ID data and require review.
  for(const p of j?.fotos||[]){if(!/^rijbewijs_/.test(p.soort))continue;
   const values={cvLicIssue:aiDatum(p.rijbewijs_afgifte),cvLicExp:aiDatum(p.rijbewijs_geldig_tot),cvName:aiSchoon((p.achternaam||'')+' '+(p.voornamen||'')),cvBirth:aiDatum(p.geboortedatum)};
   for(const [key,value] of Object.entries(values))if(value&&$(key)&&!$(key).value){$(key).value=value;result.iets=true;result.twijfelLic=true;}
  }
  return result;};
 const classifyBase=soortVanFoto;
 soortVanFoto=async function(file){const hint=file?.atlasScanHint;if(!hint)return classifyBase(file);if(hint.startsWith('rijbewijs_'))return {soort:'licence',zijde:''};if(hint==='paspoort')return {soort:'passport',zijde:'achter'};return {soort:'cin',zijde:hint==='id_voor'?'voorkant':'achter'};};
 tekenAILamp=function(){const lamp=$('nwAILamp');if(!lamp)return;lamp.textContent=({fr:'Scan intelligent en premier · lecteur local en secours',nl:'Slimme scan eerst · lokale lezer als reserve',ar:'المسح الذكي أولاً · القارئ المحلي احتياطي'})[L];lamp.onclick=null;};
})();
