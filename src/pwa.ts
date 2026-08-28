const SW='/sw.js';
const DB='cm-v11-pwa';
const STORE='alarms';
let audioCtx:AudioContext|null=null;
let alarmTimer:number|null=null;
let activeAlarmKey='';

function openDB(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function saveAlarms(alarms:any[]){const db=await openDB();return new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);s.clear();alarms.forEach(a=>s.put(a));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}

function installNotificationBridge(){
  const Native=(window as any).Notification;
  if(!Native||Native.__cmBridge)return;
  const Bridge:any=function(title:string,options?:NotificationOptions){
    if(navigator.serviceWorker?.controller){navigator.serviceWorker.ready.then(r=>r.showNotification(title,options||{})).catch(()=>{});return {close(){}};}
    return new Native(title,options);
  };
  Object.defineProperty(Bridge,'permission',{get:()=>Native.permission});
  Bridge.requestPermission=Native.requestPermission.bind(Native);
  Bridge.__cmBridge=true;
  try{Object.defineProperty(window,'Notification',{value:Bridge,writable:true,configurable:true});}catch{}
}

function beep(){
  try{
    const A=window.AudioContext||(window as any).webkitAudioContext;
    if(!A)return;
    audioCtx=audioCtx||new A();
    if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type='sine';o.frequency.value=880;g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.14,audioCtx.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.42);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.45);
    if('vibrate' in navigator)navigator.vibrate?.([350,180,350]);
  }catch{}
}
function stopLoop(){if(alarmTimer!==null){clearInterval(alarmTimer);alarmTimer=null;}activeAlarmKey='';}

function syncSchedule(){
  try{
    const raw=localStorage.getItem('cm-v11-store');if(!raw)return;
    const d=JSON.parse(raw);const sid=localStorage.getItem('cm-v11-session');const u=d.users?.find((x:any)=>x.id===sid);const pid=u?.patientId||u?.id;if(!pid)return;
    const meds=d.medications?.[pid]||[];const events=d.events?.filter((e:any)=>e.patientId===pid)||[];const now=Date.now();
    const step=(m:any)=>m.interval*(m.unit==='min'?60000:m.unit==='hour'?3600000:86400000);
    const base=(m:any)=>{let t=m.start?Date.parse(m.start):NaN;if(m.relatedId){const r=meds.find((x:any)=>x.id===m.relatedId);if(r?.start)t=Date.parse(r.start)+(m.offset||0)*60000;}return t;};
    const alarms:any[]=[];
    for(const m of meds){if(m.paused||!m.start||m.interval<=0)continue;let t=base(m);const s=step(m);if(!Number.isFinite(t))continue;while(t<=now)t+=s;for(let i=0;i<6;i++){const at=t+i*s;const dup=events.some((e:any)=>e.medId===m.id&&e.scheduledAt&&Math.abs(Date.parse(e.scheduledAt)-at)<60000);if(!dup)alarms.push({id:`${m.id}-${at}`,medId:m.id,name:m.name,at,enabled:true,notified:false});}}
    saveAlarms(alarms).then(()=>navigator.serviceWorker?.controller?.postMessage({type:'SYNC_ALARMS',alarms})).catch(()=>{});
  }catch{}
}

export async function registerPWA(){
  if(!('serviceWorker' in navigator))return;
  try{
    const reg=await navigator.serviceWorker.register(SW,{scope:'/'});
    installNotificationBridge();
    const ready=await navigator.serviceWorker.ready;
    if('periodicSync' in ready){try{await (ready as any).periodicSync.register('medication-alarms',{minInterval:15*60*1000});}catch{}}
    syncSchedule();
    setInterval(syncSchedule,30000);
    navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='OPEN_ALARM')window.focus();});
    window.addEventListener('storage',e=>{if(e.key==='cm-v11-store')syncSchedule();});
    // Foreground continuous alarm: best effort. Browser autoplay policies still apply until the user interacts.
    setInterval(()=>{
      try{
        const raw=localStorage.getItem('cm-v11-store'),sid=localStorage.getItem('cm-v11-session');if(!raw||!sid)return;
        const d=JSON.parse(raw),u=d.users?.find((x:any)=>x.id===sid),pid=u?.patientId||u?.id,meds=d.medications?.[pid]||[],events=d.events?.filter((e:any)=>e.patientId===pid)||[];const now=Date.now();
        for(const m of meds){if(m.paused||!m.start)continue;let t=Date.parse(m.start);if(m.relatedId){const r=meds.find((x:any)=>x.id===m.relatedId);if(r?.start)t=Date.parse(r.start)+(m.offset||0)*60000;}const s=m.interval*(m.unit==='min'?60000:m.unit==='hour'?3600000:86400000);if(!Number.isFinite(t)||s<=0)continue;const due=t<=now? t+Math.floor((now-t)/s)*s:null;const done=events.some((e:any)=>e.medId===m.id&&e.scheduledAt&&due&&Math.abs(Date.parse(e.scheduledAt)-due)<60000);if(due&&now-due<=120000&&!done){const key=`${m.id}-${due}`;if(activeAlarmKey!==key){activeAlarmKey=key;beep();if(alarmTimer===null)alarmTimer=window.setInterval(beep,2200);}return;} }
        if(activeAlarmKey)stopLoop();
      }catch{}
    },1000);
  }catch(e){console.warn('PWA não disponível:',e);}
}
