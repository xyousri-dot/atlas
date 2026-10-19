/* Cache an exact public-file allowlist, never APIs,
   customer documents, subscriptions, authentication responses or arbitrary URLs. */
const OFFLINE_CACHE='atlas-scan-20261018';
let offlineListPromise;
function offlineList(){return offlineListPromise||(offlineListPromise=fetch(new URL('./offline-manifest.json',self.registration.scope),{cache:'no-store',credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('manifest');return r.json();}).then(x=>x.files).catch(e=>{offlineListPromise=null;throw e;}));}
function safeOfflinePath(path){return /^\.\/(?:index\.html|paid-scanner\.js|guided-scanner\.js|offline-scanner\.js|offline-cache\.js|offline-manifest\.json|scan-quality\.js|vehicle-warranties\.js|warranty-rules\.mjs|manifest\.webmanifest|atlas-icon\.svg|scan-assets\/[a-zA-Z0-9_./-]+)$/.test(path)&&!path.includes('..');}
self.addEventListener('message',event=>{
 if(!['atlas-offline-prepare','atlas-offline-status'].includes(event.data?.type)||!event.ports?.[0])return;
 event.waitUntil((async()=>{try{
  const cache=await caches.open(OFFLINE_CACHE);
  if(event.data.type==='atlas-offline-prepare'){
   const files=await offlineList();if(!Array.isArray(files)||!files.length||files.some(p=>!safeOfflinePath(p)))throw Error('allowlist');
   for(const path of files){const url=new URL(path,self.registration.scope);const r=await fetch(url,{cache:'reload',credentials:'same-origin',redirect:'error'});if(!r.ok||r.type==='opaque'||r.redirected)throw Error('download');await cache.put(url,r);}
   // Mark readiness only after every required file is stored.
   await cache.put(new URL('./offline-ready',self.registration.scope),new Response(JSON.stringify(files)));
   // Old scanner bundles contain public assets only. Remove them only after a
   // complete replacement, never delete other app or customer-data stores.
   for(const name of await caches.keys())if((name.startsWith('atlas-test-scan-')||name.startsWith('atlas-scan-'))&&name!==OFFLINE_CACHE)await caches.delete(name);
  }
  const marker=await cache.match(new URL('./offline-ready',self.registration.scope));const files=marker?await marker.json():[];
  const ready=files.length>0&&(await Promise.all(files.map(p=>cache.match(new URL(p,self.registration.scope))))).every(Boolean);
  event.ports[0].postMessage({ready});
 }catch{event.ports[0].postMessage({ready:false,error:'offline-unavailable'});}})());
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url),base=new URL(self.registration.scope);
 if(req.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.search)return;
 const relative='./'+url.pathname.slice(base.pathname.length);
 if(req.mode==='navigate'&&(relative==='./'||relative==='./index.html')){
  event.respondWith(caches.open(OFFLINE_CACHE).then(async cache=>{try{const fresh=await fetch(req,{cache:'no-cache'});if(fresh.ok&&!fresh.redirected)await cache.put(new URL('./index.html',base),fresh.clone());return fresh;}catch{const saved=await cache.match(new URL('./index.html',base));return saved||Response.error();}}));return;
 }
 if(!safeOfflinePath(relative))return;
 // With internet, update the installed app automatically. Cached public files
 // are only the fallback; they must never pin an old Atlas release.
 event.respondWith(caches.open(OFFLINE_CACHE).then(async cache=>{try{const fresh=await fetch(req,{cache:'no-cache'});if(fresh.ok&&!fresh.redirected)await cache.put(req,fresh.clone());return fresh;}catch{const saved=await cache.match(req);return saved||Response.error();}}));
});
