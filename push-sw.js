/* No fetch handler: never cache customer files, auth tokens or application HTML. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
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
  const receivedAt=new Date().toISOString();await atlasPushReceipt({receivedAt,state:'received'});
  try{await self.registration.showNotification('Atlas',{
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
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(w=>w.url.startsWith(self.registration.scope));
    if(existing){await existing.navigate(url);return existing.focus();}
    return self.clients.openWindow(url);
  })());
});
