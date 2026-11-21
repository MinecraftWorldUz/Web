const CACHE='mw-public-shell-winter-v20';
const SCOPE=self.registration.scope;
const PUBLIC_ASSETS=['./assets/winter-logo-192.png','./manifest.webmanifest','./winter.css?v=2','./assets/winter-mountains.webp']
  .map(path=>new URL(path,SCOPE).href);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>
    cache.addAll(PUBLIC_ASSETS))
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
  if(PUBLIC_ASSETS.includes(url.href)){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(req))||fetch(req)));
    return;
  }
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
