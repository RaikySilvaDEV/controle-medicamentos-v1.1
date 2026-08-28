import React from 'react';
import{createRoot}from'react-dom/client';
import App from'./App';
import'./style.css';

// Migração segura da V1.1: versões anteriores podiam ter salvo um store vazio
// ou associado os medicamentos a outro patientId. Nunca apaga histórico/contas.
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
  const demo=d.users.find((u:any)=>u.email==='paciente@demo.local');
  const patientId=demo?.patientId||demo?.id||'patient-demo';
  if(demo){demo.patientId=patientId;demo.shareCode=demo.shareCode||'DEMO-1234';}
  if(!d.patients.some((p:any)=>p.id===patientId))d.patients.push({id:patientId,name:demo?.name||'Paciente Demo'});
  // Se a store antiga não tem medicamentos válidos, recupera os quatro iniciais.
  const has=Array.isArray(d.medications[patientId])&&d.medications[patientId].length>0;
  const old=Array.isArray(d.medications['patient-demo'])?d.medications['patient-demo']:[];
  if(!has && old.length)d.medications[patientId]=old;
  if(!Array.isArray(d.medications[patientId])||d.medications[patientId].length===0)d.medications[patientId]=seed;
  // Garante a relação correta sem transformar +7 min em frequência de 7 min.
  const brim=d.medications[patientId].find((m:any)=>m.id==='med-brim');
  if(brim){brim.interval=12;brim.unit='hour';brim.relatedId='med-dorz';brim.offset=7;}
  localStorage.setItem(KEY,JSON.stringify(d));
 }
}catch(e){console.warn('Migração V1.1 ignorada:',e)}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
