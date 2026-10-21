import {mkdirSync,copyFileSync,readFileSync,writeFileSync,cpSync} from 'node:fs';
import {prepareAssets,assetRoot} from './scan-assets.mjs';
import {createHash} from 'node:crypto';
import {testEnvironment,testAdmin,TEST_URL,TEST_KEY} from './test-environment.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// No automatic release to a production domain, including this pilot's stable alias.
if(process.env.VERCEL_ENV==='production')throw Error('Production release requires a separate, explicitly approved release workflow.');
const root=fileURLToPath(new URL('../',import.meta.url));
console.log('Test runtime:',process.version,'ICU',process.versions.icu,'timezone data',process.versions.tz);
const tests=['push','push-server','push-monitor','maintenance','warranty','scan-quality','paid-scan','rental-flow','availability','scanner','test-environment'].map(n=>'tests/'+n+'.test.mjs');
const result=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const out=new URL('../pilot-dist/',import.meta.url);mkdirSync(out,{recursive:true});
writeFileSync(new URL('index.html',out),testEnvironment(readFileSync(new URL('../index.html',import.meta.url),'utf8')));
writeFileSync(new URL('admin.html',out),testAdmin(readFileSync(new URL('../admin.html',import.meta.url),'utf8')));
for(const file of ['manifest.webmanifest','push-sw.js','atlas-icon.svg','vehicle-warranties.js','scan-quality.js'])copyFileSync(new URL('../'+file,import.meta.url),new URL(file,out));
copyFileSync(new URL('../supabase/functions/_shared/warranty.mjs',import.meta.url),new URL('warranty-rules.mjs',out));
const assets=await prepareAssets();cpSync(assetRoot,new URL('scan-assets/',out),{recursive:true});
for(const file of ['offline-scanner.js','offline-cache.js','paid-scanner.js','guided-scanner.js'])copyFileSync(new URL('../'+file,import.meta.url),new URL(file,out));
const releaseHash=createHash('sha256');
for(const file of ['index.html','offline-scanner.js','offline-cache.js','paid-scanner.js','guided-scanner.js','scan-quality.js','vehicle-warranties.js','warranty-rules.mjs','manifest.webmanifest','atlas-icon.svg'])releaseHash.update(readFileSync(new URL(file,out)));
const scanVersion=releaseHash.update(readFileSync(new URL('./scan-assets-lock.json',import.meta.url))).digest('hex').slice(0,12);
writeFileSync(new URL('offline-cache.js',out),readFileSync(new URL('../offline-cache.js',import.meta.url),'utf8').replace('atlas-scan-20261018','atlas-test-scan-'+scanVersion));
writeFileSync(new URL('push-sw.js',out),readFileSync(new URL('../push-sw.js',import.meta.url),'utf8').replace('atlas-scan-20261018','atlas-test-scan-'+scanVersion).replace('const ATLAS_RECEIPT_CONFIG=null;','const ATLAS_RECEIPT_CONFIG='+JSON.stringify({url:TEST_URL+'/functions/v1/atlas-push',key:TEST_KEY})+';')+"\n// Scanner release "+scanVersion+"\n");
writeFileSync(new URL('offline-manifest.json',out),JSON.stringify({files:['./index.html','./offline-scanner.js','./offline-cache.js','./paid-scanner.js','./guided-scanner.js','./scan-quality.js','./vehicle-warranties.js','./warranty-rules.mjs','./manifest.webmanifest','./atlas-icon.svg',...assets.map(a=>'./scan-assets/'+a.path)]}));
console.log('Pilot built: tests passed; only explicitly listed public app files copied.');
