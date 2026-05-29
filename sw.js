const CACHE='rs-v2.0';
const ASSETS=[
  './','./index.html','./manifest.json',
  './icons/icon-192.png','./icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.allSettled(ASSETS.map(function(u){return c.add(u).catch(function(){return null;})}));
  }).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(function(cached){
    if(cached)return cached;
    return fetch(e.request).then(function(r){
      if(r.ok){var cl=r.clone();caches.open(CACHE).then(function(c){c.put(e.request,cl);});}
      return r;
    }).catch(function(){return cached||new Response('Offline',{status:503});});
  }));
});
