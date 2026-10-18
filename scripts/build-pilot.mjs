import {mkdirSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {testEnvironment,testAdmin} from './test-environment.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// No automatic release to a production domain, including this pilot's stable alias.
if(process.env.VERCEL_ENV==='production')throw Error('Production release requires a separate, explicitly approved release workflow.');
const root=fileURLToPath(new URL('../',import.meta.url));
console.log('Test runtime:',process.version,'ICU',process.versions.icu,'timezone data',process.versions.tz);
const tests=['push','push-server','maintenance','rental-flow','availability','scanner','test-environment'].map(n=>'tests/'+n+'.test.mjs');
const result=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const out=new URL('../pilot-dist/',import.meta.url);mkdirSync(out,{recursive:true});
writeFileSync(new URL('index.html',out),testEnvironment(readFileSync(new URL('../index.html',import.meta.url),'utf8')));
writeFileSync(new URL('admin.html',out),testAdmin(readFileSync(new URL('../admin.html',import.meta.url),'utf8')));
for(const file of ['manifest.webmanifest','push-sw.js','atlas-icon.svg'])copyFileSync(new URL('../'+file,import.meta.url),new URL(file,out));
console.log('Pilot built: tests passed; only five public app files copied.');
