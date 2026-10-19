/* Guided phone capture: collect both sides first, then make one scan request. */
(function(){
 const button=document.getElementById('nwScanKaart');if(!button)return;
 const copy={
  nl:{title:'Documenten scannen',intro:'Kies ID voor+achter óf de fotopagina van het paspoort. Voeg het rijbewijs toe als dat nodig is.',front:'ID · voorkant',back:'ID · achterkant met code',passport:'Paspoort · fotopagina',licFront:'Rijbewijs · voorkant (optioneel)',licBack:'Rijbewijs · achterkant (optioneel)',take:'Camera',choose:'Kies foto',replace:'Andere',ready:'Gereed',go:n=>'Lees '+n+' foto'+(n===1?'':'\'s'),cancel:'Annuleren',need:'Voeg ID voor+achter óf de fotopagina van het paspoort toe.'},
  fr:{title:'Scanner les documents',intro:'Ajoutez la CIN recto+verso ou la page photo du passeport. Ajoutez le permis si nécessaire.',front:'CIN · recto',back:'CIN · verso avec le code',passport:'Passeport · page photo',licFront:'Permis · recto (facultatif)',licBack:'Permis · verso (facultatif)',take:'Caméra',choose:'Choisir',replace:'Changer',ready:'Prêt',go:n=>'Lire '+n+' photo'+(n===1?'':'s'),cancel:'Annuler',need:'Ajoutez la CIN recto+verso ou la page photo du passeport.'},
  ar:{title:'مسح الوثائق',intro:'أضف وجهي البطاقة أو صفحة الصورة في جواز السفر. أضف الرخصة عند الحاجة.',front:'البطاقة · الوجه الأمامي',back:'البطاقة · الوجه الخلفي مع الرمز',passport:'جواز السفر · صفحة الصورة',licFront:'الرخصة · الوجه الأمامي (اختياري)',licBack:'الرخصة · الوجه الخلفي (اختياري)',take:'الكاميرا',choose:'اختيار صورة',replace:'تغيير',ready:'جاهز',go:n=>'قراءة '+n+' صور',cancel:'إلغاء',need:'أضف وجهي البطاقة أو صفحة الصورة في جواز السفر.'}
 };
 function text(){return copy[window.L]||copy.fr;}
 function openGuide(additional=false){
  const t=text(),files={},previews={},shade=document.createElement('div');shade.className='ask guided-scan';
  const panel=document.createElement('div');panel.className='guided-panel';shade.appendChild(panel);
  panel.innerHTML='<h2></h2><p class="fine guided-intro"></p><div class="guided-list"></div><p class="fine guided-error" role="status"></p><button type="button" class="btn guided-go" disabled></button><button type="button" class="btn ghost sm guided-cancel"></button>';
  panel.querySelector('h2').textContent=t.title;panel.querySelector('.guided-intro').textContent=t.intro;
  const list=panel.querySelector('.guided-list'),go=panel.querySelector('.guided-go'),error=panel.querySelector('.guided-error');
  const rows=[['front',t.front],['back',t.back],['passport',t.passport],['licFront',t.licFront],['licBack',t.licBack]];
  let pending=0;
  const messages=({nl:{opening:'Bestand openen…',error:'Dit bestand kan niet worden geopend. Kies een JPG/PNG-foto of maak een foto met de camera.',empty:'Het bestand is leeg. Download het eerst op je telefoon.'},fr:{opening:'Ouverture du fichier…',error:'Ce fichier ne peut pas être ouvert. Choisissez une photo JPG/PNG ou utilisez la caméra.',empty:'Le fichier est vide. Téléchargez-le d’abord sur votre téléphone.'},ar:{opening:'جار فتح الملف…',error:'تعذر فتح الملف. اختر صورة JPG/PNG أو استخدم الكاميرا.',empty:'الملف فارغ. نزّله أولا على هاتفك.'}})[window.L]||{opening:'Ouverture…',error:'Choisissez une photo JPG/PNG.',empty:'Fichier vide.'};
  function refresh(){const chosen=Object.keys(files).length;go.disabled=!!pending||!chosen;go.textContent=t.go(chosen);}
  rows.forEach(([key,label])=>{
   const row=document.createElement('div');row.className='guided-row';
   const info=document.createElement('div');info.className='guided-info';const name=document.createElement('b');name.textContent=label;const state=document.createElement('span');state.textContent='—';info.append(name,state);
   const actions=document.createElement('div');actions.className='guided-actions';
   // The native input covers its visible label. iPhone opens the picker directly
   // from the user's tap, without forwarding clicks to a display:none input.
   const take=document.createElement('label');take.className='btn sm';const cameraText=document.createElement('span');cameraText.textContent=t.take;take.append(cameraText);
   const choose=document.createElement('label');choose.className='btn ghost sm';const libraryText=document.createElement('span');libraryText.textContent=t.choose;choose.append(libraryText);
   const camera=document.createElement('input');camera.type='file';camera.accept='image/*,.heic,.heif';camera.setAttribute('capture','environment');camera.className='guided-camera';camera.setAttribute('aria-label',label+' · '+t.take);
   const library=document.createElement('input');library.type='file';library.accept='image/*,.heic,.heif';library.className='guided-library';library.setAttribute('aria-label',label+' · '+t.choose);
   let selection=0;
   async function selected(input){const file=input.files?.[0];if(!file)return;const current=++selection;pending++;delete files[key];state.className='guided-opening';state.textContent=messages.opening+' '+file.name;refresh();
    try{if(!file.size)throw Error(messages.empty);const url=URL.createObjectURL(file),thumb=document.createElement('img');thumb.alt='';
     try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(messages.error)),8000);thumb.onload=()=>{clearTimeout(timer);resolve();};thumb.onerror=()=>{clearTimeout(timer);reject(Error(messages.error));};thumb.src=url;});}catch(e){URL.revokeObjectURL(url);throw e;}
     if(current!==selection){URL.revokeObjectURL(url);return;}file.atlasScanHint=key==='front'?'id_voor':key==='back'?'id_achter':key==='passport'?'paspoort':key==='licFront'?'rijbewijs_voor':'rijbewijs_achter';files[key]=file;if(previews[key])URL.revokeObjectURL(previews[key]);previews[key]=url;state.replaceChildren();const mark=document.createElement('span');mark.textContent='✓ '+t.ready+' · '+file.name;state.append(mark,thumb);state.className='guided-ok';error.textContent='';
     // Prepare each chosen picture while the owner selects the next side.
     // fotoVoorAI keeps this in memory, so starting the scan does not repeat it.
     if(window.ATLAS_AI_SCAN_ENABLED&&navigator.onLine)fotoVoorAI(file).catch(()=>{});
    }catch(e){if(current===selection){state.textContent=e.message||messages.error;state.className='guided-error';error.textContent=state.textContent;}}finally{pending--;input.value='';refresh();}}
   camera.addEventListener('change',()=>selected(camera));library.addEventListener('change',()=>selected(library));
   take.append(camera);choose.append(library);actions.append(take,choose);row.append(info,actions);list.appendChild(row);
  });
  function close(){Object.values(previews).forEach(url=>URL.revokeObjectURL(url));shade.remove();}
  go.addEventListener('click',()=>{if(go.disabled)return;const batch=rows.map(x=>files[x[0]]).filter(Boolean);close();snelScan(batch,'auto');});
  panel.querySelector('.guided-cancel').textContent=t.cancel;panel.querySelector('.guided-cancel').addEventListener('click',close);shade.addEventListener('click',e=>{if(e.target===shade)close();});
  document.body.appendChild(shade);refresh();
 }
 button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openGuide();},true);
 const extra=document.getElementById('nwScanLic');if(extra)extra.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openGuide(true);},true);
 const nativeStyle=document.createElement('style');nativeStyle.textContent='.guided-actions label{position:relative;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center}.guided-actions input[type=file]{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px}';document.head.appendChild(nativeStyle);
 const style=document.createElement('style');style.textContent='.guided-panel{width:min(620px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:var(--card,#fff);border-radius:22px;padding:22px;box-shadow:0 24px 70px #0003}.guided-panel h2{margin:0 0 6px}.guided-intro{margin:0 0 14px}.guided-list{display:grid;gap:9px}.guided-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--line,#ddd);border-radius:14px}.guided-info{display:grid;gap:3px;min-width:0}.guided-info>span{font-size:13px;color:var(--muted,#68707d)}.guided-info .guided-ok{color:var(--ok,#18864b);font-weight:700;display:flex;align-items:center;gap:7px;max-width:250px}.guided-ok span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.guided-ok img{width:34px;height:28px;object-fit:cover;border-radius:5px;background:var(--line,#ddd)}.guided-actions{display:flex;gap:7px}.guided-error{min-height:20px;color:var(--warn,#a35a00);margin:8px 0}.guided-go,.guided-cancel{width:100%;margin-top:8px}@media(max-width:520px){.guided-panel{padding:18px}.guided-row{display:grid}.guided-actions{width:100%}.guided-actions .btn{flex:1}.guided-info .guided-ok{max-width:100%}}';document.head.appendChild(style);
})();
