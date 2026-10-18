import {mkdirSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// No automatic release to a production domain, including this pilot's stable alias.
if(process.env.VERCEL_ENV==='production')throw Error('Production release requires a separate, explicitly approved release workflow.');
const root=fileURLToPath(new URL('../',import.meta.url));
const tests=['push','maintenance','rental-flow','availability','scanner'].map(n=>'tests/'+n+'.test.mjs');
const result=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const out=new URL('../pilot-dist/',import.meta.url);mkdirSync(out,{recursive:true});
for(const file of ['index.html','manifest.webmanifest','push-sw.js','atlas-icon.svg'])copyFileSync(new URL('../'+file,import.meta.url),new URL(file,out));
console.log('Pilot built: tests passed; only four public app files copied.');
