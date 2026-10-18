/* TEST only: paid primary, one bounded attempt, then the offline reserve. */
(function(){
 if(!SBSTANDAARD.url.includes('manikkusokwysmdfhxtu')||location.protocol==='file:')return;
 window.ATLAS_AI_SCAN_ENABLED=true;
 let paidAttempts=0;
 aiLees=async function(files){
  AIFOUT='';window.ATLAS_PAID_SCAN_OK=false;window.ATLAS_SCAN_CONFLICT=false;
  if(!navigator.onLine){AIFOUT='offline';return null;}if(!sbKlaar()){AIFOUT='uit';return null;}
  if(!files?.length||files.length>6){AIFOUT='aantal';return null;}
  if(paidAttempts>=1){AIFOUT='retry-limit';return null;}paidAttempts++;
  try{
   const fotos=[];for(const f of files)fotos.push({type:'image/jpeg',data:await fotoVoorAI(f)});
   const stop=new AbortController(),timer=setTimeout(()=>stop.abort(),25000);let response;
   try{response=await fetch(sbBasis()+'/functions/v1/atlas-scan',{method:'POST',headers:{apikey:SB.key,Authorization:'Bearer '+SBSES.access_token,'x-atlas-user-token':SBSES.access_token,'Content-Type':'application/json'},body:JSON.stringify({fotos,requestId:crypto.randomUUID()}),signal:stop.signal});}finally{clearTimeout(timer);}
   if(!response.ok){AIFOUT=String(response.status);if(response.status===409){window.ATLAS_SCAN_CONFLICT=true;return {fotos:[],identityConflict:true};}return null;}
   const j=await response.json();if(!j||!Array.isArray(j.fotos)){AIFOUT='leeg';return null;}window.ATLAS_PAID_SCAN_OK=true;return j;
  }catch{AIFOUT='net';return null;}
 };
 const scanBase=snelScan;
 snelScan=async function(){if(SCAN_RUNNING)return;paidAttempts=0;const result=await scanBase.apply(this,arguments);if(window.ATLAS_SCAN_CONFLICT)scanQualityNotice(({fr:'Documents contradictoires : scannez une seule personne à la fois.',nl:'Tegenstrijdige documenten: scan één persoon tegelijk.',ar:'وثائق متعارضة. امسح وثائق شخص واحد فقط.'})[L]);return result;};
 const fillBase=aiVul;
 aiVul=async function(j,files){if(j?.identityConflict){scanQualityNotice(({fr:'Documents contradictoires : scannez une seule personne à la fois.',nl:'Tegenstrijdige documenten: scan één persoon tegelijk.',ar:'وثائق متعارضة. امسح وثائق شخص واحد فقط.'})[L]);return {iets:true,twijfelDoc:true,twijfelLic:true};}return fillBase(j,files);};
 tekenAILamp=function(){const lamp=$('nwAILamp');if(!lamp)return;lamp.textContent=({fr:'Scan intelligent en premier · lecteur local en secours',nl:'Slimme scan eerst · lokale lezer als reserve',ar:'المسح الذكي أولاً · القارئ المحلي احتياطي'})[L];lamp.onclick=null;};
})();
