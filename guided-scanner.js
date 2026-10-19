/* Guided phone capture: collect both sides first, then make one scan request. */
(function(){
 const button=document.getElementById('nwScanKaart');if(!button)return;
 const copy={
  nl:{title:'Documenten scannen',intro:'Fotografeer telkens de hele kaart — niet alleen de code. Alle vier hoeken moeten zichtbaar zijn.',front:'1. ID · voorkant',back:'2. ID · achterkant met code',licFront:'Rijbewijs · voorkant (optioneel)',licBack:'Rijbewijs · achterkant (optioneel)',take:'Foto maken',replace:'Opnieuw',ready:'Gereed',go:n=>'Lees '+n+' foto'+(n===1?'':'\'s'),gallery:'Bestaande foto’s samen kiezen',cancel:'Annuleren',need:'Maak eerst een foto van de voor- én achterkant van het ID.'},
  fr:{title:'Scanner les documents',intro:'Photographiez toute la carte, pas seulement le code. Les quatre coins doivent être visibles.',front:'1. CIN · recto',back:'2. CIN · verso avec le code',licFront:'Permis · recto (facultatif)',licBack:'Permis · verso (facultatif)',take:'Prendre la photo',replace:'Reprendre',ready:'Prêt',go:n=>'Lire '+n+' photo'+(n===1?'':'s'),gallery:'Choisir plusieurs photos existantes',cancel:'Annuler',need:'Photographiez d’abord le recto et le verso de la CIN.'},
  ar:{title:'مسح الوثائق',intro:'صوّر البطاقة كاملة وليس الرمز فقط. يجب أن تظهر الزوايا الأربع.',front:'1. البطاقة · الوجه الأمامي',back:'2. البطاقة · الوجه الخلفي مع الرمز',licFront:'الرخصة · الوجه الأمامي (اختياري)',licBack:'الرخصة · الوجه الخلفي (اختياري)',take:'التقاط صورة',replace:'إعادة',ready:'جاهز',go:n=>'قراءة '+n+' صور',gallery:'اختيار عدة صور موجودة',cancel:'إلغاء',need:'صوّر أولا الوجه الأمامي والخلفي للبطاقة.'}
 };
 function text(){return copy[window.L]||copy.fr;}
 function openGuide(){
  const t=text(),files={},shade=document.createElement('div');shade.className='ask guided-scan';
  const panel=document.createElement('div');panel.className='guided-panel';shade.appendChild(panel);
  panel.innerHTML='<h2></h2><p class="fine guided-intro"></p><div class="guided-list"></div><p class="fine guided-error" role="status"></p><button type="button" class="btn guided-go" disabled></button><button type="button" class="btn ghost guided-gallery"></button><button type="button" class="btn ghost sm guided-cancel"></button>';
  panel.querySelector('h2').textContent=t.title;panel.querySelector('.guided-intro').textContent=t.intro;
  const list=panel.querySelector('.guided-list'),go=panel.querySelector('.guided-go'),error=panel.querySelector('.guided-error');
  const rows=[['front',t.front,true],['back',t.back,true],['licFront',t.licFront,false],['licBack',t.licBack,false]];
  function refresh(){const chosen=Object.keys(files).length;go.disabled=!(files.front&&files.back);go.textContent=t.go(chosen);}
  rows.forEach(([key,label,required])=>{
   const row=document.createElement('div');row.className='guided-row';
   const info=document.createElement('div');info.className='guided-info';const name=document.createElement('b');name.textContent=label;const state=document.createElement('span');state.textContent=required?'—':'';info.append(name,state);
   const take=document.createElement('button');take.type='button';take.className='btn sm';take.textContent=t.take;
   const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('capture','environment');input.hidden=true;
   take.addEventListener('click',()=>input.click());input.addEventListener('change',()=>{if(!input.files?.[0])return;files[key]=input.files[0];state.textContent='✓ '+t.ready;state.className='guided-ok';take.textContent=t.replace;error.textContent='';refresh();});
   row.append(info,take,input);list.appendChild(row);
  });
  function close(){shade.remove();}
  go.addEventListener('click',()=>{if(!(files.front&&files.back)){error.textContent=t.need;return;}const batch=rows.map(x=>files[x[0]]).filter(Boolean);close();snelScan(batch,'auto');});
  panel.querySelector('.guided-gallery').textContent=t.gallery;panel.querySelector('.guided-gallery').addEventListener('click',()=>{close();document.getElementById('snelKies').click();});
  panel.querySelector('.guided-cancel').textContent=t.cancel;panel.querySelector('.guided-cancel').addEventListener('click',close);shade.addEventListener('click',e=>{if(e.target===shade)close();});
  document.body.appendChild(shade);refresh();
 }
 button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openGuide();},true);
 const style=document.createElement('style');style.textContent='.guided-panel{width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:var(--card,#fff);border-radius:22px;padding:22px;box-shadow:0 24px 70px #0003}.guided-panel h2{margin:0 0 6px}.guided-intro{margin:0 0 14px}.guided-list{display:grid;gap:9px}.guided-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--line,#ddd);border-radius:14px}.guided-info{display:grid;gap:3px}.guided-info span{font-size:13px;color:var(--muted,#68707d)}.guided-info .guided-ok{color:var(--ok,#18864b);font-weight:700}.guided-error{min-height:20px;color:var(--warn,#a35a00);margin:8px 0}.guided-go,.guided-gallery,.guided-cancel{width:100%;margin-top:8px}@media(max-width:520px){.guided-panel{padding:18px}.guided-row{align-items:flex-start}.guided-row .btn{min-width:112px}}';document.head.appendChild(style);
})();
