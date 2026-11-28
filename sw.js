const CACHE='mw-public-shell-winter-v25';
const SCOPE=self.registration.scope;
const INDEX=new URL('./index.html',SCOPE).href;
const PUBLIC_ASSETS=['./assets/winter-logo-192.png?v=21','./favicon.ico?v=21','./manifest.webmanifest','./winter.css?v=20.2','./assets/winter-mountains.webp','./mw-live-chat.js?v=groups36','./chat-landscapes.js?v=1','./mw-v11.js?v=20'].map(path=>new URL(path,SCOPE).href);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled([INDEX,...PUBLIC_ASSETS].map(url=>cache.add(new Request(url,{cache:'reload'}))));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mw-public-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(PUBLIC_ASSETS.includes(url.href)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match(req);if(cached)return cached;
      const response=await fetch(req);
      if(response.ok)try{await cache.put(req,response.clone());}catch{}
      return response;
    })());
    return;
  }
  // Only public mod covers; no API responses, private attachments or auth tokens.
  const publicCover=url.origin==='https://ruovdgyfcucspffrvijh.supabase.co'&&url.pathname.startsWith('/storage/v1/object/public/covers/');
  const bundledCover=url.origin===self.location.origin&&url.pathname.startsWith(new URL('./site-mods/',SCOPE).pathname);
  if(req.destination==='image'&&(publicCover||bundledCover)){
    event.respondWith((async()=>{
      const cache=await caches.open('mw-public-covers-v1');
      const cached=await cache.match(req);if(cached)return cached;
      const response=await fetch(req);
      if(response.ok)try{
        await cache.put(req,response.clone());
        const entries=await cache.keys();
        await Promise.all(entries.slice(0,Math.max(0,entries.length-40)).map(entry=>cache.delete(entry)));
      }catch{}
      return response;
    })());
    return;
  }
  const scopePath=new URL(SCOPE).pathname;
  if(req.mode==='navigate'&&url.origin===self.location.origin&&(url.pathname===scopePath||url.pathname===new URL(INDEX).pathname)){
    const task=(async()=>{
      const online=await fetch(req);
      if(online.ok)try{const cache=await caches.open(CACHE);await cache.put(INDEX,online.clone());}catch{}
      return online;
    })();
    event.waitUntil(task.then(()=>{},()=>{}));
    event.respondWith((async()=>{
      const cached=await (await caches.open(CACHE)).match(INDEX);
      if(!cached)return task.catch(()=>Response.error());
      return Promise.race([task.catch(()=>cached),new Promise(resolve=>setTimeout(()=>resolve(cached),1800))]);
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
    if(n.target)link.searchParams.set('target',n.target);
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
