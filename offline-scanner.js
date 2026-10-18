/* Test-only local OCR. No paid calls, no customer photos in Cache Storage. */
(function(){
 if(typeof SBSTANDAARD==='undefined'||!SBSTANDAARD.url.includes('manikkusokwysmdfhxtu')||location.protocol==='file:')return;
 const base=new URL('./',location.href),asset=p=>new URL('scan-assets/'+p,base).href;
 LIBS.ocr.urls=[asset('tesseract.min.js')];
 let starting=null;
 ocrWorker=async function(melden){
  if(OCRW)return OCRW;if(starting)return starting;
  starting=(async()=>{if(!await needLib('ocr')){OCRFOUT='offline reader unavailable';return null;}
   try{OCRW=await Tesseract.createWorker('fra+eng',1,{workerPath:asset('worker.min.js'),corePath:asset('core/'),langPath:asset('lang/'),workerBlobURL:false,cacheMethod:'none',logger:m=>{if(melden&&m?.status)melden(m.status,m.progress||0);}});return OCRW;}
   catch{OCRFOUT='offline reader unavailable';return null;}
  })();try{return await starting;}finally{starting=null;}
 };
 // Offline means local only: do not attempt AI or an optional external OCR service.
 const aiBase=aiLees,spaceBase=ocrSpaceTekst;
 aiLees=async function(files){if(!navigator.onLine){AIFOUT='offline';return null;}if(window.ATLAS_AI_SCAN_ENABLED!==true){AIFOUT='local';return null;}return aiBase(files);};
 ocrSpaceTekst=async function(){return navigator.onLine?spaceBase.apply(this,arguments):'';};
 // Try the bundled text engine before the slower custom character search.
 // Only accept machine-readable lines that pass the existing check digits.
 const mrzBase=readMRZ,fastReads=new WeakMap();
 readMRZ=async function(blob,opts){
  let hit=null;try{
   if(!fastReads.has(blob))fastReads.set(blob,(async()=>{const img=await blobImg(blob);const canvases=kaartVoorOcr(img).slice(0,2);for(const canvas of canvases){const text=await tesseractTekst(canvas,()=>{});const read=plakMRZ(text);if(read)return {...read,docShaky:true,altShaky:true};}return null;})());
   hit=await fastReads.get(blob);
  }catch{}
  return hit||mrzBase(blob,opts);
 };
 window.atlasOfflineRequest=async function(type){
  if(!navigator.serviceWorker||!window.isSecureContext)throw Error('secure-site-required');
  const reg=await navigator.serviceWorker.register('./push-sw.js');await navigator.serviceWorker.ready;
  const worker=reg.installing||reg.waiting||reg.active;if(!worker)throw Error('worker');
  if(worker.state!=='activated')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('activation')),15000);const changed=()=>{if(worker.state==='activated'){clearTimeout(timer);worker.removeEventListener('statechange',changed);resolve();}else if(worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',changed);reject(Error('worker'));}};worker.addEventListener('statechange',changed);changed();});
  return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('timeout'));},120000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage({type},[channel.port2]);});
 };
 const text=()=>({fr:{title:'Scanner sans internet',prepare:'Préparer le scan hors ligne',busy:'Téléchargement du lecteur… Gardez cette page ouverte.',ready:'Prêt hors ligne sur cet appareil. Photos uniquement (JPG/PNG). Vérifiez toujours les données.',help:'À préparer une fois avec internet. Les photos restent lues sur cet appareil. Hors ligne : pas de synchronisation ni de messages envoyés.',error:'Préparation incomplète. Reconnectez-vous et réessayez. Ne videz pas les données du navigateur.'},nl:{title:'Scannen zonder internet',prepare:'Offline scannen voorbereiden',busy:'Lezer downloaden… Houd deze pagina open.',ready:'Offline klaar op dit toestel. Alleen foto’s (JPG/PNG). Controleer altijd de gegevens.',help:'Eenmalig voorbereiden met internet. Foto’s worden op dit toestel gelezen. Offline: geen synchronisatie of verzonden meldingen.',error:'Voorbereiden niet gelukt. Maak verbinding en probeer opnieuw. Wis de browsergegevens niet.'},ar:{title:'المسح دون إنترنت',prepare:'تجهيز المسح دون إنترنت',busy:'تنزيل القارئ… اترك الصفحة مفتوحة.',ready:'جاهز دون إنترنت على هذا الجهاز. صور JPG/PNG فقط. تحقق دائماً من البيانات.',help:'جهزه مرة واحدة مع الإنترنت. القراءة على جهازك. دون إنترنت لا تتم المزامنة أو إرسال التنبيهات.',error:'لم يكتمل التجهيز. اتصل بالإنترنت وحاول مجدداً. لا تمسح بيانات المتصفح.'}})[L];
 function panel(){if(!document.getElementById('nwScanStat'))return;document.getElementById('offlineScanPanel')?.remove();
  const t=text(),box=el('div','card');box.id='offlineScanPanel';const status=el('p','fine',t.help+' (≈34 MB)'),button=el('button','btn ghost',t.prepare);button.type='button';button.id='offlineScanPrepare';status.id='offlineScanStatus';status.setAttribute('role','status');box.append(el('h3',null,t.title),status,button);$('nwScanStat').parentNode.appendChild(box);
  button.onclick=async()=>{button.disabled=true;status.textContent=t.busy;try{const r=await atlasOfflineRequest('atlas-offline-prepare');status.textContent=r.ready?t.ready:t.error;}catch{status.textContent=t.error;}finally{button.disabled=false;}};
  atlasOfflineRequest('atlas-offline-status').then(r=>{if(r.ready)status.textContent=t.ready;}).catch(()=>{});
 }
 const newBase=openNew;openNew=function(){const r=newBase.apply(this,arguments);panel();return r;};
})();
