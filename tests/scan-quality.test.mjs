import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {leesHtml,scriptUit,zandbak} from './atlas.mjs';
function setup(){
 const a=zandbak(scriptUit(leesHtml())),fields={};
 for(const id of ['cvName','cvDocNo','cvBirth','cvDocExp','cvNat','cvAddr','cvLic','cvLicIssue','cvLicExp','nwName','nwDocNo','nwLicNo','scanReviewed'])fields[id]={value:'',checked:true};
 a.$=id=>fields[id]||null;a.SNELFORM=true;a.SNELKLANT={name:'TEST PERSON',docNumber:'AB123456'};fields.cvName.value='TEST PERSON';fields.cvDocNo.value='AB123456';a.clientDraft={scans:{original:'photo'}};
 a.ctlZet=(k,v)=>{a.SNELKLANT[k]=v;fields[({name:'cvName',docNumber:'cvDocNo',birth:'cvBirth'})[k]].value=v;};
 a.markKlantKlaar=()=>{};a.tekenControle=()=>{};a.openNew=()=>{};a.aiVul=async()=>({iets:true});a.snelScan=async()=>{};
 vm.runInContext(readFileSync(new URL('../scan-quality.js',import.meta.url),'utf8'),a);a.scanQualityNotice=text=>{a.notice=text;};
 return {a,fields};
}
test('Handmatig gecorrigeerde naam, nummer en datum overleven volgende scan; bevestiging vervalt',async()=>{
 const {a,fields}=setup();a.ctlZet('name','CORRECT TEST');a.ctlZet('birth','1990-03-04');a.SCANBEVESTIGD='confirmed';
 a.scanReaderBase=async()=>{fields.cvName.value='WRONG TEST';fields.cvBirth.value='1999-01-01';a.SNELKLANT.name='WRONG TEST';};
 await a.snelScan([{}],'auto');assert.equal(fields.cvName.value,'CORRECT TEST');assert.equal(fields.cvBirth.value,'1990-03-04');assert.equal(a.SNELKLANT.name,'CORRECT TEST');assert.equal(a.SCANBEVESTIGD,'');assert.equal(fields.scanReviewed.checked,false);
});
test('Documentnummer van andere lezing wordt nooit stilletjes aan huidige klant gekoppeld',async()=>{
 const {a,fields}=setup();a.scanReaderBase=async()=>{fields.cvDocNo.value='XX999999';a.SNELKLANT.docNumber='XX999999';a.clientDraft.scans.new='other document';};
 await a.snelScan([{}],'auto');assert.equal(fields.cvDocNo.value,'AB123456');assert.equal(a.SNELKLANT.docNumber,'AB123456');assert.equal(a.clientDraft.scans.new,undefined);assert.equal(a.SCANTWIJFEL.docNumber,true);assert.equal(a.notice,a.scanQualityText().conflict);
});
test('Ongeldige kalenderdatum en geboortedatum in toekomst worden niet overgenomen',async()=>{
 const {a,fields}=setup();assert.equal(a.aiDatum('2026-02-30'),'');assert.equal(a.aiDatum('2024-02-29'),'2024-02-29');fields.cvBirth.value='2099-01-01';
 await a.aiVul({},[]);assert.equal(fields.cvBirth.value,'');assert.equal(a.SCANTWIJFEL.birth,true);
});
test('Dubbele scan start geen tweede lezer en fout blokkeert volgende scan niet',async()=>{
 const {a}=setup();let release,reads=0;a.scanReaderBase=()=>{reads++;return new Promise(r=>release=r);};
 const running=a.snelScan([{}],'auto');await a.snelScan([{}],'auto');assert.equal(reads,1);release();await running;assert.equal(a.SCAN_RUNNING,false);
 a.scanReaderBase=async()=>{throw Error('decode');};await a.snelScan([{}],'auto');assert.equal(a.SCAN_RUNNING,false);assert.equal(a.SNELBEZIG,null);
});
