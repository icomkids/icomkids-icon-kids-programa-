'use client';
import {useEffect,useState} from 'react';
const preferenceKey='ia-bank-theme';
export default function BankThemeToggle({onChange}:{onChange:(theme:'dark'|'light')=>void}){
 const [theme,setTheme]=useState<'dark'|'light'>('dark');
 useEffect(()=>{const restore=()=>{let saved:'dark'|'light'='dark';try{if(localStorage.getItem(preferenceKey)==='light')saved='light';}catch{}setTheme(saved);onChange(saved);};restore();window.addEventListener('storage',restore);return()=>window.removeEventListener('storage',restore);},[onChange]);
 return <button type="button" className="bank-theme-toggle" aria-label={theme==='dark'?'Mudar para tema claro':'Mudar para tema escuro'} title={theme==='dark'?'Usar fundo claro':'Voltar ao azul escuro'} onClick={()=>{const next=theme==='dark'?'light':'dark';setTheme(next);onChange(next);try{localStorage.setItem(preferenceKey,next);}catch{}}}><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">{theme==='dark'?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z"/>}</svg><span>{theme==='dark'?'Tema claro':'Tema escuro'}</span></button>;
}
