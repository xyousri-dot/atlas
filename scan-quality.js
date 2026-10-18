/* Conservative guard around the existing reader. Never invent identity data. */
var SCAN_MANUAL={},SCAN_RUNNING=false,SCAN_QUALITY_INVALID=false;
function scanQualityText(){return ({
 fr:{service:'Le lecteur avancé est indisponible. Le lecteur local peut se tromper : comparez le nom, les numéros et les dates avec la photo avant de valider.',conflict:'Les lectures ne concordent pas. Les données précédentes ont été conservées. Vérifiez qu’il s’agit de la même personne.',manual:'Vos corrections ont été conservées. Vérifiez les autres champs avant de valider.',invalid:'Certaines valeurs lues sont impossibles ou incertaines. Corrigez-les en regardant le document.',error:'La lecture n’a pas abouti. Reprenez une photo nette, sans reflet, avec les quatre coins visibles. Vous pouvez aussi remplir les champs à la main.'},
 nl:{service:'De geavanceerde lezer is niet beschikbaar. De lokale lezer kan fouten maken: vergelijk naam, nummers en datums met de foto voordat je bevestigt.',conflict:'De lezingen spreken elkaar tegen. De eerdere gegevens zijn bewaard. Controleer of dit dezelfde persoon is.',manual:'Je correcties zijn behouden. Controleer de overige velden voordat je bevestigt.',invalid:'Sommige gelezen waarden zijn onmogelijk of onzeker. Corrigeer ze met het document erbij.',error:'Lezen is niet gelukt. Maak een scherpe foto zonder reflectie en met alle vier hoeken zichtbaar. Je kunt de velden ook handmatig invullen.'},
 ar:{service:'القارئ المتقدم غير متاح. قد يخطئ القارئ المحلي. قارن الاسم والأرقام والتواريخ مع الصورة قبل التأكيد.',conflict:'القراءات متعارضة. احتفظنا بالمعلومات السابقة. تحقق أن الوثيقة لنفس الشخص.',manual:'تم الاحتفاظ بتصحيحاتك. راجع بقية الحقول قبل التأكيد.',invalid:'بعض القيم غير ممكنة أو غير مؤكدة. صححها بمقارنتها بالوثيقة.',error:'لم تنجح القراءة. التقط صورة واضحة دون انعكاس تظهر فيها الزوايا الأربع. يمكنك إدخال المعلومات يدوياً.'}
 })[L];}
function scanQualityNotice(text){
 if(text&&text===scanQualityText().service&&(AIFOUT==='local'||AIFOUT==='offline')){if($('nwScanAI'))$('nwScanAI').hidden=true;text=({fr:'Lecture locale sur cet appareil. Comparez le nom, les numéros et les dates avec la photo avant de valider.',nl:'Lokaal gelezen op dit toestel. Vergelijk naam, nummers en datums met de foto voordat je bevestigt.',ar:'تمت القراءة على جهازك. قارن الاسم والأرقام والتواريخ مع الصورة قبل التأكيد.'})[L];}
 var stat=$('nwScanStat');if(!stat)return;
 var note=$('scanQualityNotice');if(!note){note=el('p','fine');note.id='scanQualityNotice';note.setAttribute('role','status');stat.parentNode.insertBefore(note,stat.nextSibling);}note.textContent=text;note.hidden=!text;
}
var SCAN_FIELDS={name:'cvName',docNumber:'cvDocNo',birth:'cvBirth',docExpiry:'cvDocExp',nationality:'cvNat',address:'cvAddr',licenceNumber:'cvLic',licenceIssue:'cvLicIssue',licenceExpiry:'cvLicExp'};
function scanValues(){var out={};Object.keys(SCAN_FIELDS).forEach(function(k){out[k]=$(SCAN_FIELDS[k])?$(SCAN_FIELDS[k]).value:'';});return out;}
function scanRestore(values){
 Object.keys(values).forEach(function(k){if($(SCAN_FIELDS[k]))$(SCAN_FIELDS[k]).value=values[k];if(SNELKLANT)SNELKLANT[k]=values[k];if(k==='name'&&$('nwName'))$('nwName').value=values[k];});
 if(SNELKLANT&&$('nwDocNo'))$('nwDocNo').value=SNELKLANT.docNumber||'';
 if(SNELKLANT&&$('nwLicNo'))$('nwLicNo').value=SNELKLANT.licenceNumber||'';
}
var scanCorrectionBase=ctlZet;
ctlZet=function(k,v){scanCorrectionBase(k,v);SCAN_MANUAL[k]=v;};
var scanNewCustomerBase=openNew;
openNew=function(){SCAN_MANUAL={};return scanNewCustomerBase.apply(this,arguments);};
var scanDateBase=aiDatum;
aiDatum=function(value){var date=scanDateBase(String(value||'').trim());return date&&echteDatum(date)?date:'';};
var scanFillBase=aiVul;
aiVul=async function(j,files){
 var result=await scanFillBase(j,files);
 var fields=scanValues(),invalid=false;
 ['birth','docExpiry','licenceIssue','licenceExpiry'].forEach(function(k){var value=fields[k];if(value&&(!echteDatum(value)||k==='birth'&&value>today())){fields[k]='';SCAN_MANUAL[k]===undefined&&($(SCAN_FIELDS[k]).value='');SCANTWIJFEL[k]=true;invalid=true;}});
 if(invalid){SCAN_QUALITY_INVALID=true;result.qualityIssue=true;result.twijfelDoc=true;result.twijfelLic=true;}
 return result;
};
var scanReaderBase=snelScan;
snelScan=async function(files,type){
 if(SCAN_RUNNING||!files||!files.length)return;
 SCAN_RUNNING=true;SCAN_QUALITY_INVALID=false;SCANBEVESTIGD='';var check=$('scanReviewed');if(check)check.checked=false;
 var before=SNELFORM&&SNELKLANT?scanValues():{},priorClient=SNELKLANT?clone(SNELKLANT):null,priorDraft=clientDraft?clone(clientDraft):null;
 scanQualityNotice('');
 try{
  await scanReaderBase(files,type);
  var after=scanValues(),normalize=function(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');};
  var conflict=before.docNumber&&after.docNumber&&normalize(before.docNumber)!==normalize(after.docNumber);
  if(conflict){
   SNELKLANT=priorClient;clientDraft=priorDraft;scanRestore(before);SCANTWIJFEL.docNumber=true;scanQualityNotice(scanQualityText().conflict);
  }else{
   scanRestore(SCAN_MANUAL);
   scanQualityNotice(AIFOUT?scanQualityText().service:SCAN_QUALITY_INVALID?scanQualityText().invalid:Object.keys(SCAN_MANUAL).length?scanQualityText().manual:'');
  }
  SCANBEVESTIGD='';markKlantKlaar();tekenControle();
 }catch(e){SNELKLANT=priorClient;clientDraft=priorDraft;var stat=$('nwScanStat');if(stat){stat.hidden=false;stat.className='snelstat half';stat.textContent=scanQualityText().error;}scanRestore(before);scanQualityNotice(scanQualityText().error);}
 finally{SCAN_RUNNING=false;SNELBEZIG=null;}
};
