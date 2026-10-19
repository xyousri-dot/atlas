/* Simple document capture: add photos first; Atlas recognises the document type. */
(function(){
 const button=document.getElementById('nwScanKaart');if(!button)return;
 const copy={
  nl:{title:'Documenten scannen',intro:'Voeg duidelijke foto’s toe. Atlas herkent zelf ID, paspoort en rijbewijs.',tip:'ID of rijbewijs? Voeg voor- en achterkant toe.',add:'Foto toevoegen',ready:'Toegevoegd',remove:'Verwijderen',go:n=>'Gegevens lezen uit '+n+' foto'+(n===1?'':'\'s'),cancel:'Annuleren',empty:'Voeg eerst een foto toe.',opening:'Foto openen…',error:'Deze foto kan niet worden geopend. Kies een JPG/PNG-foto of maak een nieuwe foto.',zero:'Het bestand is leeg. Download het eerst op je telefoon.',limit:'Maximaal 6 foto’s per scan.'},
  fr:{title:'Scanner les documents',intro:'Ajoutez des photos nettes. Atlas reconnaît la CIN, le passeport et le permis.',tip:'CIN ou permis ? Ajoutez le recto et le verso.',add:'Ajouter une photo',ready:'Ajoutée',remove:'Supprimer',go:n=>'Lire les données de '+n+' photo'+(n===1?'':'s'),cancel:'Annuler',empty:'Ajoutez d’abord une photo.',opening:'Ouverture de la photo…',error:'Cette photo ne peut pas être ouverte. Choisissez une photo JPG/PNG ou prenez-en une nouvelle.',zero:'Le fichier est vide. Téléchargez-le d’abord sur votre téléphone.',limit:'Maximum 6 photos par scan.'},
  ar:{title:'مسح الوثائق',intro:'أضف صوراً واضحة. يتعرف أطلس تلقائياً على البطاقة والجواز والرخصة.',tip:'البطاقة أو الرخصة؟ أضف الوجه الأمامي والخلفي.',add:'إضافة صورة',ready:'تمت الإضافة',remove:'حذف',go:n=>'قراءة البيانات من '+n+' صور',cancel:'إلغاء',empty:'أضف صورة أولاً.',opening:'جار فتح الصورة…',error:'تعذر فتح هذه الصورة. اختر صورة JPG/PNG أو التقط صورة جديدة.',zero:'الملف فارغ. نزّله أولاً على هاتفك.',limit:'الحد الأقصى 6 صور لكل عملية.'}
 };
 function text(){return copy[window.L]||copy.fr;}
 function openGuide(additional=false){
  const t=text(),items=[],shade=document.createElement('div');shade.className='ask guided-scan';
  const panel=document.createElement('div');panel.className='guided-panel';shade.appendChild(panel);
  panel.innerHTML='<h2></h2><p class="fine guided-intro"></p><p class="guided-tip"></p><div class="guided-picker"></div><div class="guided-list" aria-live="polite"></div><p class="fine guided-error" role="status"></p><button type="button" class="btn guided-go" disabled></button><button type="button" class="btn ghost sm guided-cancel"></button>';
  panel.querySelector('h2').textContent=t.title;panel.querySelector('.guided-intro').textContent=t.intro;panel.querySelector('.guided-tip').textContent=t.tip;
  const picker=panel.querySelector('.guided-picker'),list=panel.querySelector('.guided-list'),go=panel.querySelector('.guided-go'),error=panel.querySelector('.guided-error');
  const label=document.createElement('label');label.className='btn guided-add';const addText=document.createElement('span');addText.textContent='+ '+t.add;
  const input=document.createElement('input');input.type='file';input.accept='image/*,.heic,.heif';input.multiple=true;input.className='guided-files';input.setAttribute('aria-label',t.add);label.append(addText,input);picker.append(label);
  let pending=0,sequence=0;
  function refresh(){go.disabled=!!pending||!items.length;go.textContent=items.length?t.go(items.length):t.empty;}
  function revoke(item){if(item?.url)URL.revokeObjectURL(item.url);}
  function remove(id){const index=items.findIndex(item=>item.id===id);if(index<0)return;revoke(items[index]);items.splice(index,1);render();}
  function render(){
   list.replaceChildren();
   items.forEach((item,index)=>{const card=document.createElement('div');card.className='guided-card';
    const img=document.createElement('img');img.src=item.url;img.alt='';
    const info=document.createElement('div');info.className='guided-card-info';const mark=document.createElement('b');mark.textContent=(item.ready?'✓ '+t.ready:t.opening)+' · '+(index+1);const name=document.createElement('span');name.textContent=item.file.name;info.append(mark,name);
    const removeButton=document.createElement('button');removeButton.type='button';removeButton.className='btn ghost sm guided-remove';removeButton.textContent=t.remove;removeButton.setAttribute('aria-label',t.remove+' '+item.file.name);removeButton.addEventListener('click',()=>remove(item.id));
    card.append(img,info,removeButton);list.append(card);
   });
   refresh();
  }
  async function decode(item){
   if(!item.file.size)throw Error(t.zero);const img=new Image();
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(t.error)),12000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error(t.error));};img.src=item.url;});
  }
  async function selected(){
   const chosen=[...(input.files||[])];if(!chosen.length)return;
   if(items.length+chosen.length>6){error.textContent=t.limit;input.value='';return;}
   error.textContent='';pending+=chosen.length;
   const added=chosen.map(file=>{if(additional)file.atlasScanHint='rijbewijs_onbekend';const item={id:++sequence,file,url:URL.createObjectURL(file),ready:false};items.push(item);return item;});
   render();input.value='';
   await Promise.all(added.map(async item=>{
    try{await decode(item);item.ready=true;if(window.ATLAS_AI_SCAN_ENABLED&&navigator.onLine)fotoVoorAI(item.file).catch(()=>{});}
    catch(e){const index=items.findIndex(current=>current.id===item.id);if(index>=0){revoke(items[index]);items.splice(index,1);}error.textContent=e.message||t.error;}
    finally{pending--;render();}
   }));
  }
  input.addEventListener('change',selected);
  function close(){items.forEach(revoke);shade.remove();}
  go.addEventListener('click',()=>{if(go.disabled)return;const batch=items.map(item=>item.file);close();snelScan(batch,'auto');});
  panel.querySelector('.guided-cancel').textContent=t.cancel;panel.querySelector('.guided-cancel').addEventListener('click',close);shade.addEventListener('click',event=>{if(event.target===shade)close();});
  document.body.appendChild(shade);refresh();
 }
 button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();openGuide();},true);
 const extra=document.getElementById('nwScanLic');if(extra)extra.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();openGuide(true);},true);
 const style=document.createElement('style');style.textContent='.guided-panel{width:min(620px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:var(--card,#fff);border-radius:22px;padding:22px;box-shadow:0 24px 70px #0003}.guided-panel h2{margin:0 0 6px}.guided-intro{margin:0 0 9px}.guided-tip{margin:0 0 16px;padding:10px 12px;border-radius:12px;background:var(--soft,#f4f6fa);font-size:14px;font-weight:700}.guided-picker{display:grid}.guided-add{position:relative;overflow:hidden;min-height:54px;display:flex;align-items:center;justify-content:center;cursor:pointer}.guided-add input[type=file]{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px}.guided-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.guided-card{display:grid;grid-template-columns:72px minmax(0,1fr);gap:10px;align-items:center;padding:10px;border:1px solid var(--line,#ddd);border-radius:14px}.guided-card>img{width:72px;height:58px;object-fit:cover;border-radius:9px;background:var(--line,#ddd)}.guided-card-info{display:grid;gap:3px;min-width:0}.guided-card-info b{color:var(--ok,#18864b);font-size:13px}.guided-card-info span{font-size:12px;color:var(--muted,#68707d);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.guided-remove{grid-column:1/-1;width:100%}.guided-error{min-height:20px;color:var(--warn,#a35a00);margin:8px 0}.guided-go,.guided-cancel{width:100%;margin-top:8px}@media(max-width:520px){.guided-panel{padding:18px}.guided-list{grid-template-columns:1fr}.guided-card{grid-template-columns:88px minmax(0,1fr) auto}.guided-card>img{width:88px;height:68px}.guided-remove{grid-column:auto;width:auto}}';document.head.appendChild(style);
})();
