const CACHE='cm-v11-pwa-v1';
const APP_SHELL=['/','/manifest.webmanifest'];
const DB='cm-v11-pwa';
const STORE='alarms';

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return r}).catch(()=>cached)));
});

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function putAlarms(alarms){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);s.clear();alarms.forEach(a=>s.put(a));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function getAlarms(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}

async function showAlarm(a){
  if(!a?.name)return;
  await self.registration.showNotification('🔔 HORA DO MEDICAMENTO',{body:`Está na hora de usar: ${a.name}`,
    tag:`med-${a.id}-${a.at}`,renotify:true,requireInteraction:true,vibrate:[500,250,500,250,900],timestamp:a.at,
    icon:'/icons/icon-192.svg',badge:'/icons/icon-192.svg',data:{url:'/',medId:a.id,scheduledAt:a.at},
    actions:[{action:'open',title:'Abrir aplicativo'},{action:'snooze',title:'Adiar 5 min'}]});
}

async function checkAlarms(){
  const now=Date.now();
  const alarms=await getAlarms();
  for(const a of alarms){
    if(a.enabled!==false && !a.notified && a.at<=now && now-a.at<10*60*1000){await showAlarm(a);a.notified=true;}
  }
  await putAlarms(alarms);
}

self.addEventListener('message',event=>{
  const d=event.data||{};
  if(d.type==='SYNC_ALARMS')event.waitUntil(putAlarms(Array.isArray(d.alarms)?d.alarms:[]).then(checkAlarms));
  if(d.type==='CHECK_ALARMS')event.waitUntil(checkAlarms());
  if(d.type==='TEST_NOTIFICATION')event.waitUntil(showAlarm({id:'test',name:'Teste de alarme',at:Date.now()}));
});

self.addEventListener('push',event=>{let data={name:'Medicamento',at:Date.now()};try{data=event.data.json()}catch{}event.waitUntil(showAlarm({id:data.id||'push',name:data.name,at:data.at||Date.now()}));});

self.addEventListener('notificationclick',event=>{
  const action=event.action;event.notification.close();
  event.waitUntil((async()=>{
    const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(action==='snooze')return;
    for(const c of clientsList){if('focus' in c){await c.focus();if(c.postMessage)c.postMessage({type:'OPEN_ALARM',data:event.notification.data});return;}}
    if(self.clients.openWindow)await self.clients.openWindow(event.notification.data?.url||'/');
  })());
});

self.addEventListener('periodicsync',event=>{if(event.tag==='medication-alarms')event.waitUntil(checkAlarms());});
