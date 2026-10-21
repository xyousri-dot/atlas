/* No fetch handler: never cache customer files, auth tokens or application HTML. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Preserve the destination across an iPhone standalone-app launch.
function atlasPushTarget(value){
  return new Promise(resolve=>{
    if(typeof indexedDB==='undefined')return resolve(null);
    const request=indexedDB.open('atlas-push-routing',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('targets');
    request.onerror=()=>resolve(null);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('targets','readwrite'),store=tx.objectStore('targets');let result=null;
      if(value)store.put(value,'pending');
      else{const get=store.get('pending');get.onsuccess=()=>{result=get.result||null;store.delete('pending');};}
      tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();resolve(null);};
    };
  });
}
/* One generic receipt only: no subscription, token, customer or message body. */
function atlasPushReceipt(value){
  return new Promise(resolve=>{
    if(typeof indexedDB==='undefined')return resolve(null);
    const request=indexedDB.open('atlas-push-health',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('health');
    request.onerror=()=>resolve(null);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('health',value?'readwrite':'readonly'),store=tx.objectStore('health');
      const op=value?store.put(value,'last-push'):store.get('last-push');let result=null;
      op.onsuccess=()=>{result=value||op.result||null;};
      tx.oncomplete=()=>{db.close();resolve(result);};
      tx.onerror=tx.onabort=()=>{db.close();resolve(null);};
    };
  });
}
self.addEventListener('message',event=>{
  if(['atlas-offline-prepare','atlas-offline-status'].includes(event.data?.type)){atlasOfflineMessage(event);return;}
  if(event.data?.type==='atlas-push-target'&&event.ports?.[0]){
    event.waitUntil((async()=>{const target=await atlasPushTarget();event.ports[0].postMessage(target&&Date.now()-target.at<300000?target:null);})());return;
  }
  if(event.data?.type!=='atlas-push-health'||!event.ports?.[0])return;
  event.waitUntil((async()=>{
    let local='not-tested';
    if(event.data.local===true){try{
      await self.registration.showNotification('Atlas · Diagnostic',{body:'Test local / Lokale test — pas une preuve de réception push.',tag:'atlas-local-diagnostic',data:{url:self.registration.scope}});local='accepted';
    }catch(e){local=String(e.name||'Error');}}
    event.ports[0].postMessage({version:2,local,receipt:await atlasPushReceipt()});
  })());
});
function atlasPushURL(value,scope){
  const base=new URL(scope);
  try{const url=new URL(value||'./',base);return url.origin===base.origin && url.pathname.startsWith(base.pathname)?url.href:base.href;}
  catch{return base.href;}
}
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  event.waitUntil((async()=>{
  const receivedAt=new Date().toISOString();
  // Display first: a locked or unavailable diagnostic database must never hold
  // up the user-visible notification on a background iPhone worker.
  try{await self.registration.showNotification(typeof data.title==='string'?data.title.slice(0,80):'Atlas',{
    body:typeof data.body==='string'?data.body.slice(0,180):'Ouvrez Atlas pour consulter vos rappels.',
    tag:typeof data.tag==='string'?data.tag:'atlas-reminders',
    icon:new URL('./atlas-icon.svg',self.registration.scope).href,
    data:{url:atlasPushURL(data.url,self.registration.scope)},
  });await atlasPushReceipt({receivedAt,state:'display-request-accepted'});}
  catch(e){await atlasPushReceipt({receivedAt,state:'display-error',error:String(e.name||'Error')});throw e;}
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=atlasPushURL(event.notification.data?.url,self.registration.scope);
    await atlasPushTarget({url,at:Date.now()});
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(w=>w.url.startsWith(self.registration.scope));
    if(existing){
      try{await existing.navigate(url);}catch{}
      if(existing.postMessage)existing.postMessage({type:'atlas-open-target',url});
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});

/* Cache only the fixed public scanner bundle. Customer photos, API responses,
   subscriptions and authentication data are never stored here. */
const OFFLINE_CACHE='atlas-scan-20261018';
let offlineListPromise;
function offlineList(){return offlineListPromise||(offlineListPromise=fetch(new URL('./offline-manifest.json',self.registration.scope),{cache:'no-store',credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('manifest');return r.json();}).then(x=>x.files).catch(e=>{offlineListPromise=null;throw e;}));}
function safeOfflinePath(path){return /^\.\/(?:index\.html|paid-scanner\.js|guided-scanner\.js|offline-scanner\.js|offline-cache\.js|offline-manifest\.json|scan-quality\.js|vehicle-warranties\.js|warranty-rules\.mjs|manifest\.webmanifest|atlas-icon\.svg|scan-assets\/[a-zA-Z0-9_./-]+)$/.test(path)&&!path.includes('..');}
function atlasOfflineMessage(event){
 if(!['atlas-offline-prepare','atlas-offline-status'].includes(event.data?.type)||!event.ports?.[0])return;
 event.waitUntil((async()=>{try{
  const cache=await caches.open(OFFLINE_CACHE);
  if(event.data.type==='atlas-offline-prepare'){
   const files=await offlineList();if(!Array.isArray(files)||!files.length||files.some(p=>!safeOfflinePath(p)))throw Error('allowlist');
   for(const path of files){const url=new URL(path,self.registration.scope);const r=await fetch(url,{cache:'reload',credentials:'same-origin',redirect:'error'});if(!r.ok||r.type==='opaque'||r.redirected)throw Error('download');await cache.put(url,r);}
   await cache.put(new URL('./offline-ready',self.registration.scope),new Response(JSON.stringify(files)));
   for(const name of await caches.keys())if((name.startsWith('atlas-test-scan-')||name.startsWith('atlas-scan-'))&&name!==OFFLINE_CACHE)await caches.delete(name);
  }
  const marker=await cache.match(new URL('./offline-ready',self.registration.scope));const files=marker?await marker.json():[];
  const ready=files.length>0&&(await Promise.all(files.map(p=>cache.match(new URL(p,self.registration.scope))))).every(Boolean);
  event.ports[0].postMessage({ready});
 }catch{event.ports[0].postMessage({ready:false,error:'offline-unavailable'});}})());
}
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url),base=new URL(self.registration.scope);
 if(req.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.search)return;
 const relative='./'+url.pathname.slice(base.pathname.length);
 if(req.mode==='navigate'&&(relative==='./'||relative==='./index.html')){
  event.respondWith(caches.open(OFFLINE_CACHE).then(async cache=>{try{const fresh=await fetch(req,{cache:'no-cache'});if(fresh.ok&&!fresh.redirected)await cache.put(new URL('./index.html',base),fresh.clone());return fresh;}catch{const saved=await cache.match(new URL('./index.html',base));return saved||Response.error();}}));return;
 }
 if(!safeOfflinePath(relative))return;
 // Network-first keeps an installed iPhone app current without reinstalling;
 // the cache remains available when the agency has no connection.
 event.respondWith(caches.open(OFFLINE_CACHE).then(async cache=>{try{const fresh=await fetch(req,{cache:'no-cache'});if(fresh.ok&&!fresh.redirected)await cache.put(req,fresh.clone());return fresh;}catch{const saved=await cache.match(req);return saved||Response.error();}}));
});
