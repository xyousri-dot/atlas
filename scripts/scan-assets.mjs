// Pinned public OCR engine/model files; never reads customer data or credentials.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const assetRoot=new URL('../scan-assets/',import.meta.url);
const lockURL=new URL('./scan-assets-lock.json',import.meta.url);
const sources=[
 ['tesseract.js@5.1.1',['/dist/tesseract.min.js','/dist/worker.min.js','/LICENSE.md','/dist/tesseract.min.js.LICENSE.txt','/dist/worker.min.js.LICENSE.txt']],
 ['tesseract.js-core@5.1.1',['/tesseract-core.wasm.js','/tesseract-core.wasm','/tesseract-core-simd.wasm.js','/tesseract-core-simd.wasm','/tesseract-core-lstm.wasm.js','/tesseract-core-lstm.wasm','/tesseract-core-simd-lstm.wasm.js','/tesseract-core-simd-lstm.wasm','/LICENSE']],
 ['@tesseract.js-data/eng@1.0.0',['/4.0.0_best_int/eng.traineddata.gz']],
 ['@tesseract.js-data/fra@1.0.0',['/4.0.0_best_int/fra.traineddata.gz']],
 ['heic-to@1.6.6',['/dist/csp/heic-to.js','/LICENSE','/README.md']]
];
const sha=data=>createHash('sha256').update(data).digest('base64');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('OCR asset HTTP '+r.status+' '+url);return r;}
export async function prepareAssets(){
 const lock=JSON.parse(await readFile(lockURL,'utf8'));await mkdir(assetRoot,{recursive:true});
 await Promise.all(lock.map(async a=>{const file=new URL(a.path,assetRoot);let data;try{data=await readFile(file);}catch{}if(data&&sha(data)===a.sha256)return;
  data=Buffer.from(await (await get(a.url)).arrayBuffer());if(sha(data)!==a.sha256)throw Error('OCR integrity mismatch '+a.path);await mkdir(new URL('./',file),{recursive:true});await writeFile(file,data);
 }));return lock;
}
if(process.argv.includes('--create-lock')){
 const lock=[];for(const [pkg,paths]of sources){const metadata=await(await get('https://data.jsdelivr.com/v1/package/npm/'+pkg+'/flat')).json();for(const path of paths){const match=metadata.files.find(x=>x.name===path);if(!match)throw Error('Missing asset '+path);const dir=pkg.startsWith('heic-to')?'heic/':pkg.startsWith('tesseract.js-core')?'core/':pkg.startsWith('@tesseract')?'lang/':'';const name=dir+(path.endsWith('LICENSE')?(dir?'LICENSE':'LICENSE-tesseract'):path.split('/').at(-1));lock.push({path:name,url:'https://cdn.jsdelivr.net/npm/'+pkg+path,sha256:match.hash,bytes:match.size});}}await writeFile(lockURL,JSON.stringify(lock,null,2)+'\n');
}
if(process.argv.includes('--prepare'))console.log('Verified OCR files:',(await prepareAssets()).length);
