import React from 'react';
import{createRoot}from'react-dom/client';
import App from'./App';
import'./style.css';
import'./reference.css';
import{registerPWA}from'./pwa';

try{
 const KEY='cm-v11-store'; const raw=localStorage.getItem(KEY);
 if(raw){
  const d=JSON.parse(raw); d.medications=d.medications||{}; d.patients=d.patients||[]; d.users=d.users||[]; d.events=d.events||[];
  const seed=[
   {id:'med-pred',name:'Acetato de prednisolona',type:'Colírio',interval:2,unit:'hour',start:null,paused:false,relatedId:null,offset:0,note:''},
   {id:'med-moxi',name:'Cloridrato de moxifloxacino',type:'Colírio',interval:3,unit:'hour',start:null,paused:false,relatedId:null,offset:0,note:''},
   {id:'med-dorz',name:'Cloridrato de dorzolamida',type:'Colírio',interval:12,unit:'hour',start:null,paused:false,relatedId:null,offset:0,note:''},
   {id:'med-brim',name:'Tartarato de brimonidina',type:'Colírio',interval:12,unit:'hour',start:null,paused:false,relatedId:'med-dorz',offset:7,note:''}
  ];
  const demo=d.users.find((u:any)=>u.email==='paciente@demo.local'); const patientId=demo?.patientId||demo?.id||'patient-demo';
  if(demo){demo.patientId=patientId;demo.shareCode=demo.shareCode||'DEMO-1234';}
  if(!d.patients.some((p:any)=>p.id===patientId))d.patients.push({id:patientId,name:demo?.name||'Paciente Demo'});
  const has=Array.isArray(d.medications[patientId])&&d.medications[patientId].length>0; const old=Array.isArray(d.medications['patient-demo'])?d.medications['patient-demo']:[];
  if(!has&&old.length)d.medications[patientId]=old; if(!Array.isArray(d.medications[patientId])||d.medications[patientId].length===0)d.medications[patientId]=seed;
  const brim=d.medications[patientId].find((m:any)=>m.id==='med-brim'); if(brim){brim.interval=12;brim.unit='hour';brim.relatedId='med-dorz';brim.offset=7;}
  localStorage.setItem(KEY,JSON.stringify(d));
 }
}catch(e){console.warn('Migração V1.1 ignorada:',e)}

// Ao definir o primeiro horário, o usuário está informando que a dose daquele
// horário já foi tomada/administrada. Ela é registrada automaticamente e o
// próximo horário passa a ser calculado pelo intervalo a partir dessa dose.
try{
 const KEY='cm-v11-store';
 const originalSetItem=Storage.prototype.setItem;
 const marker='__cm_initial_dose_fix__';
 if(!(window as any)[marker]){
  (window as any)[marker]=true;
  Storage.prototype.setItem=function(key:string,value:string){
   if(key!==KEY)return originalSetItem.call(this,key,value);
   try{
    const previousRaw=this.getItem(KEY);
    const previous=previousRaw?JSON.parse(previousRaw):null;
    const next=JSON.parse(value);
    if(next?.medications&&Array.isArray(next.events)){
     const sessionId=localStorage.getItem('cm-v11-session');
     const sessionUser=next.users?.find((u:any)=>u.id===sessionId);
     const oldMeds:Record<string,any[]> = previous?.medications||{};
     for(const patientId of Object.keys(next.medications)){
      const oldList=oldMeds[patientId]||[];
      const oldById=new Map(oldList.map((m:any)=>[m.id,m]));
      for(const med of next.medications[patientId]||[]){
       const old=oldById.get(med.id);
       if(!old?.start&&med.start){
        const startIso=new Date(med.start).toISOString();
        const already=next.events.some((e:any)=>e.patientId===patientId&&e.medId===med.id&&e.scheduledAt&&Math.abs(Date.parse(e.scheduledAt)-Date.parse(startIso))<1000);
        if(!already){
         next.events.push({
          id:crypto.randomUUID(),patientId,medId:med.id,medName:med.name,
          at:startIso,
          by:sessionUser?.role==='caregiver'?(sessionUser.name||'Acompanhante'):'Paciente',
          kind:sessionUser?.role==='caregiver'?'administered':'used',
          scheduledAt:startIso
         });
        }
       }
      }
     }
    }
    return originalSetItem.call(this,key,JSON.stringify(next));
   }catch(e){
    console.warn('Registro automático da dose inicial ignorado:',e);
    return originalSetItem.call(this,key,value);
   }
  };
 }
}catch(e){console.warn('Regra de dose inicial não instalada:',e)}

registerPWA();createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
