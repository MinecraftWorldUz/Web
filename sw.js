const CACHE='mw-public-shell-v1-1-mod-file-fix';
const SCOPE=self.registration.scope;
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>
    cache.addAll([new URL('./favicon.svg',SCOPE).href,new URL('./manifest.webmanifest',SCOPE).href]))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mw-public-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  // Never cache Supabase API, user sessions, or private data.
  if(req.mode==='navigate'&&url.origin===self.location.origin&&url.pathname.startsWith('/Web/')){
    event.respondWith((async()=>{
      try{
        const online=await fetch(req);
        if(online.ok){
          const cache=await caches.open(CACHE);
          cache.put(new URL('./index.html',SCOPE).href,online.clone()).catch(()=>{});
        }
        return online;
      }catch{
        const cache=await caches.open(CACHE);
        return (await cache.match(new URL('./index.html',SCOPE).href))||
          Response.error();
      }
    })());
  }
});
