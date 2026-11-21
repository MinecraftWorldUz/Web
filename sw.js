const CACHE='mw-public-shell-winter-v21';
const SCOPE=self.registration.scope;
const PUBLIC_ASSETS=['./assets/winter-logo-192.png?v=21','./favicon.ico?v=21','./manifest.webmanifest','./winter.css?v=20.2','./assets/winter-mountains.webp']
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
  // Reuse public mod covers only; storage paths are unique per upload.
  const publicCover=url.origin==='https://ruovdgyfcucspffrvijh.supabase.co'&&url.pathname.startsWith('/storage/v1/object/public/covers/');
  const bundledCover=url.origin===self.location.origin&&url.pathname.startsWith(new URL('./site-mods/',SCOPE).pathname);
  if(req.destination==='image'&&(publicCover||bundledCover)){
    event.respondWith((async()=>{
      const cache=await caches.open('mw-public-covers-v1');
      const cached=await cache.match(req);
      if(cached)return cached;
      const response=await fetch(req);
      if(response.ok){
        try{
          await cache.put(req,response.clone());
          const entries=await cache.keys();
          await Promise.all(entries.slice(0,Math.max(0,entries.length-16)).map(entry=>cache.delete(entry)));
        }catch{}
      }
      return response;
    })());
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

const DEVICE_CACHE='mw-device-notification-settings';
const deviceKey=new URL('push-device',SCOPE).href;
self.addEventListener('push',event=>{
  if(!event.data)return;
  event.waitUntil((async()=>{
    const n=event.data.json();
    const settings=await (await caches.open(DEVICE_CACHE)).match(deviceKey);
    if(!settings||await settings.text()!==n.user)return;
    const link=new URL(SCOPE);
    link.searchParams.set('notice',n.kind);
    link.searchParams.set('recipient',n.user);
    if(n.actor)link.searchParams.set('actor',n.actor);
    await self.registration.showNotification(n.title,{
      body:n.body,icon:new URL('assets/winter-logo-192.png?v=21',SCOPE).href,
      tag:'mw-'+n.id,data:{link:link.href}
    });
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL(event.notification.data?.link||SCOPE,SCOPE);
  if(url.origin===self.location.origin)event.waitUntil(self.clients.openWindow(url.href));
});
