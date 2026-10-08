'use client';
import {useState,type MouseEvent} from 'react';
import {useRouter,usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import BankVoiceAssistant from './BankVoiceAssistant';
import {bankMenu,bankPath,canBank,type BankProfile} from '@/lib/icom-bank/model';
export default function BankShell({profile,children}:{profile:BankProfile;children:ReactNode}){const router=useRouter();const pathname=usePathname();const [query,setQuery]=useState(''),[menu,setMenu]=useState(false),[assistantOpen,setAssistantOpen]=useState(false);
 function navigate(event:MouseEvent<HTMLDivElement>){
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const anchor=event.target instanceof Element?event.target.closest('a[href]'):null;
  if(!(anchor instanceof HTMLAnchorElement)||anchor.hasAttribute('download')||anchor.target&&anchor.target!=='_self')return;
  const url=new URL(anchor.href,location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith(bankPath('/'))||url.pathname.includes('/api/')||url.pathname.endsWith('/login')||url.pathname===location.pathname&&url.search===location.search&&url.hash)return;
  event.preventDefault();setMenu(false);
  // Preserve the shared layout and the ongoing voice connection during internal navigation.
  router.push(url.pathname.replace(/^\/experiencia-icom(?=\/)/,'')+url.search+url.hash);
 }
 return <div className={'bank-app'+(assistantOpen?' has-assistant':'')} onClick={navigate}><aside className={menu?'bank-sidebar open':'bank-sidebar'}><a className="bank-brand" href={bankPath('/dashboard')}><img src="/experiencia-icom/ia-bank-logo.jpeg" alt="IA Bank" width="190" height="124"/><small>Empresa · Vida pessoal · Inteligência</small></a><p className="bank-sidebar-label">GESTÃO DA CARTEIRA</p><nav>{bankMenu.filter(([key])=>canBank(profile.role,key)).map(([key,label],index)=><a key={key} aria-current={pathname.endsWith('/'+key)?'page':undefined} href={bankPath('/'+key)}><span>{String(index+1).padStart(2,'0')}</span>{label}</a>)}</nav><div className="bank-profile"><strong>{profile.name}</strong><small>{profile.role} · acesso autorizado</small><button onClick={async()=>{await fetch(bankPath('/api/session'),{method:'DELETE'});location.assign(bankPath('/login'));}}>Sair do IA Bank</button></div></aside><div className="bank-main"><header className="bank-header"><button className="bank-menu" aria-label="Abrir menu" onClick={()=>setMenu(!menu)}>☰</button>{canBank(profile.role,'clientes')?<form action={bankPath('/clientes')} onSubmit={event=>{event.preventDefault();router.push('/icom-bank/clientes?q='+encodeURIComponent(query));}}><input aria-label="Busca global" name="q" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente por nome ou CPF..."/><button>Buscar</button></form>:<span>IA BANK · Controle Financeiro</span>}<span className="bank-internal">USO INTERNO</span><BankVoiceAssistant role={profile.role} onPanelChange={setAssistantOpen}/></header><main className="bank-content">{children}</main><footer className="bank-footer">IA BANK · Empresa, vida pessoal e patrimônio</footer></div></div>}
