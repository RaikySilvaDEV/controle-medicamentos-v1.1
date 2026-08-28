const CACHE='cm-v11-pwa-v2';
const APP_SHELL=['/','/manifest.webmanifest'];
const DB='cm-v11-pwa';
const STORE='alarms';

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});}return r}).catch(()=>caches.match(event.request).then(c=>c||caches.match('/'))));
});

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function putAlarms(alarms){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);s.clear();for(const a of alarms)s.put(a);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function getAlarms(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}

async function showAlarm(a){
  if(!a?.name)return;
  await self.registration.showNotification('🔔 HORA DO MEDICAMENTO',{body:`Está na hora de usar: ${a.name}`,
    tag:`med-${a.medId||a.id}-${a.at}`,renotify:true,requireInteraction:true,vibrate:[500,250,500,250,900],timestamp:a.at,
    icon:'/icons/icon-192.svg',badge:'/icons/icon-192.svg',data:{url:'/',medId:a.medId||a.id,scheduledAt:a.at}});
}

async function checkAlarms(){
  const now=Date.now();
  const alarms=await getAlarms();
  let changed=false;
  for(const a of alarms){
    if(a.enabled!==false&&!a.notified&&a.at<=now){
      // If Android/browser wakes late, surface a missed alarm instead of silently losing it.
      if(now-a.at<=24*60*60*1000)await showAlarm(a);
      a.notified=true;changed=true;
    }
  }
  if(changed)await putAlarms(alarms);
}

self.addEventListener('message',event=>{
  const d=event.data||{};
  if(d.type==='SYNC_ALARMS')event.waitUntil(putAlarms(Array.isArray(d.alarms)?d.alarms:[]).then(checkAlarms));
  if(d.type==='CHECK_ALARMS')event.waitUntil(checkAlarms());
  if(d.type==='TEST_NOTIFICATION')event.waitUntil(showAlarm({id:'test',medId:'test',name:'Teste de alarme',at:Date.now()}));
});

self.addEventListener('push',event=>{let data={name:'Medicamento',at:Date.now()};try{data=event.data.json()}catch{}event.waitUntil(showAlarm({id:data.id||'push',medId:data.medId||data.id||'push',name:data.name,at:data.at||Date.now()}));});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of clientsList){if('focus' in c){await c.focus();c.postMessage?.({type:'OPEN_ALARM',data:event.notification.data});return;}}
    if(self.clients.openWindow)await self.clients.openWindow(event.notification.data?.url||'/');
  })());
});

self.addEventListener('periodicsync',event=>{if(event.tag==='medication-alarms')event.waitUntil(checkAlarms());});
