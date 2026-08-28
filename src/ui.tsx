import React from 'react';
export const Card=({children,className='' }:{children:React.ReactNode;className?:string})=><div className={`rounded-2xl border bg-white/90 p-4 shadow-sm ${className}`}>{children}</div>;
export const Button=({children,className='',...p}:React.ButtonHTMLAttributes<HTMLButtonElement>)=><button className={`min-h-11 rounded-xl px-4 py-2 font-semibold transition active:scale-95 hover:shadow ${className}`} {...p}>{children}</button>;
export const IconButton=({children,...p}:React.ButtonHTMLAttributes<HTMLButtonElement>)=><button className="grid h-11 w-11 place-items-center rounded-xl border bg-white text-lg transition active:scale-90 hover:bg-slate-50" {...p}>{children}</button>;
export const Badge=({children}:{children:React.ReactNode})=><span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{children}</span>;
