// Reuse the existing fictional document layouts; output only temporary images.
import {readFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const directory=mkdtempSync(join(tmpdir(),'atlas-fictional-live-'));
mkdirSync(join(directory,'png'));
let source=readFileSync(new URL('./maak.mjs',import.meta.url),'utf8');
source=source.replace(/import puppeteer from [^;]+;/,'import puppeteer from '+JSON.stringify(new URL('../node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js',import.meta.url).href)+';');
source=source.replace(/const MAP = [^;]+;/,'const MAP = '+JSON.stringify(directory+'/')+';');
source=source.replace(/const OCRB = [^;]+;/,'const OCRB = "";');
source=source.replace('const STIJL = `','const STIJL = `.kaart::after,.pp::after{content:"SPECIMEN — FICTIF — TEST UNIQUEMENT";position:absolute;top:48%;left:0;right:0;text-align:center;font:bold 22px Arial;color:#a00000;opacity:.45;pointer-events:none}');
source=source.replace('for (const p of CIN)', 'for (const p of CIN.slice(0,1))').replace('for (const p of RIJBEWIJS)', 'for (const p of RIJBEWIJS.slice(0,1))').replace('for (const p of PASPOORT)', 'for (const p of [])');
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
if(process.platform==='darwin'){
 for(const name of ['cin1-voor','cin1-achter','lic1-voor','lic1-achter']){
  const result=spawnSync('/usr/bin/sips',['-s','format','heic',join(directory,'png',name+'.png'),'--out',join(directory,'png',name+'.heic')]);
  if(result.status!==0)throw Error('HEIC fixture conversion failed');
 }
 const rotated=spawnSync('/usr/bin/sips',['-s','format','heic','-r','90',join(directory,'png','lic1-voor.png'),'--out',join(directory,'png','lic1-voor-rotated.heic')]);
 if(rotated.status!==0)throw Error('Rotated HEIC fixture conversion failed');
}
console.log('FICTITIOUS_FIXTURES='+directory+'/png');
