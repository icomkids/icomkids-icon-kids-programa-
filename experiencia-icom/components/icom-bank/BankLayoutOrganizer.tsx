'use client';
import {useEffect,useRef,useState,type DragEvent,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {usePathname} from 'next/navigation';
import {GripVertical,LayoutGrid,RotateCcw,Check} from 'lucide-react';
import {useBankPreferences} from './BankPreferences';
import {moveItem,orderedMenu,reconcileOrder} from '@/lib/icom-bank/preferences';
import type {BankRole} from '@/lib/icom-bank/model';
type Item={id:string;label:string;element:HTMLElement};
type Group={id:string;element:HTMLElement;items:Item[]};
const selectors=['.bank-content','.ia-overview','.ia-priority-grid','.ia-results','.ia-money-links','.ia-overview-actions','.bank-kpis','.bank-mini','.bank-grid','.bank-columns','.bank-admin-areas','.bank-admin-calculation','.bank-cash-grid','.ia-personal-tabs','.bank-agenda-tabs','.bank-admin-tabs','.bank-personal-actions','.bank-financial-navigation','.bank-daily-layout','.bank-wa-grid','.bank-personal-groups','.bank-stats','.bank-investors-layout','.bank-personal-grid'];
function hash(text:string){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);}
function itemLabel(e:HTMLElement){const label=e.querySelector('.ia-label,h1,h2,h3,h4,summary,[data-layout-label]')?.textContent||Array.from(e.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ')||e.querySelector('span')?.childNodes[0]?.textContent||e.getAttribute('aria-label')||e.tagName;return label.trim().replace(/\s+/g,' ').slice(0,80);}
function eligible(e:HTMLElement){return !e.matches('.bank-heading,.ia-period-caption,.bank-error,[role=alert],.bank-layout-toolbar,[data-layout-handle],dialog,script,style,input,select,label,table,thead,tbody,tr,button.bank-layout-handle')&&!e.hidden;}
export function BankDragHandle({group,id,label,ids,onMove}:{group:string;id:string;label:string;ids:string[];onMove:(from:string,to:string)=>void}){
 const touch=useRef<{x:number;y:number}|null>(null);
 function key(e:KeyboardEvent){if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();const i=ids.indexOf(id),target=ids[i+(['ArrowUp','ArrowLeft'].includes(e.key)?-1:1)];if(target)onMove(id,target);}
 return <span className="bank-layout-handle" data-layout-handle data-drag-group={group} data-drag-id={id} role="button" tabIndex={0} aria-label={'Arrastar '+label+'. Use também as setas do teclado.'} title={'Arrastar '+label} draggable
 onClick={e=>{e.preventDefault();e.stopPropagation();}} onKeyDown={key}
 onDragStart={(e:DragEvent)=>{e.stopPropagation();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/ia-bank-layout',JSON.stringify({group,id}));document.documentElement.dataset.bankDragging='true';}}
 onDragEnd={()=>{delete document.documentElement.dataset.bankDragging;document.querySelectorAll('.bank-layout-drop').forEach(e=>e.classList.remove('bank-layout-drop'));}}
 onPointerDown={e=>{if(e.pointerType==='mouse')return;e.preventDefault();e.stopPropagation();touch.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{if(!touch.current)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-drag-group="'+CSS.escape(group)+'"][data-drag-id]');document.querySelectorAll('.bank-layout-drop').forEach(x=>x.classList.remove('bank-layout-drop'));target?.classList.add('bank-layout-drop');}}
 onPointerUp={e=>{if(!touch.current)return;touch.current=null;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-drag-group="'+CSS.escape(group)+'"][data-drag-id]');if(target?.dataset.dragId)onMove(id,target.dataset.dragId);document.querySelectorAll('.bank-layout-drop').forEach(x=>x.classList.remove('bank-layout-drop'));}}
 onPointerCancel={()=>{touch.current=null;}}><GripVertical size={15}/><span className="bank-drag-caption">Mover</span></span>;
}
export function BankOrganizeButton(){const {organizing,setOrganizing,loading}=useBankPreferences();return <button className="bank-organize-button" disabled={loading} aria-pressed={organizing} onClick={()=>setOrganizing(!organizing)}>{organizing?<Check size={16}/>:<LayoutGrid size={16}/>}<span>{organizing?'Concluir':'Organizar tela'}</span></button>;}
export default function BankLayoutOrganizer({role}:{role:BankRole}){
 const pathname=usePathname(),{preferences,organizing,save,notice}=useBankPreferences(),[groups,setGroups]=useState<Group[]>([]),signature=useRef('');
 useEffect(()=>{
  const main=document.querySelector<HTMLElement>('.bank-content');if(!main)return;
  function discover(){const next:Group[]=[];for(const selector of selectors){const found=selector==='.bank-content'?[main!]:Array.from(main!.querySelectorAll<HTMLElement>(selector));found.forEach((container,index)=>{
   const children=Array.from(container.children).filter((x):x is HTMLElement=>x instanceof HTMLElement&&eligible(x));
   // Main sections and information cards are movable; records and form fields keep their safe order.
   const items=children.filter(e=>selector!=='.bank-content'&&selector!=='.ia-overview'||e.matches('section,article,details,.bank-panel,.bank-card,.bank-kpis,.bank-mini,.bank-grid,.bank-financial-navigation,.ia-priority-grid,.ia-results,.ia-personal-strip,.ia-money-links,.ia-overview-actions'));
   if(items.length<2)return;const group=(pathname||'/icom-bank')+':'+selector+':'+index;
   const duplicates=new Map<string,number>();const mapped=items.map(e=>{const label=itemLabel(e),base=e.dataset.bankLayoutKey||hash(e.tagName+':'+e.className.split(' ').filter(c=>!c.startsWith('bank-layout')).slice(0,1).join('')+':'+label);const n=duplicates.get(base)||0;duplicates.set(base,n+1);return {id:base+(n?'-'+n:''),label,element:e};});
   next.push({id:group,element:container,items:mapped});
  });}
   const s=next.map(g=>g.id+'='+g.items.map(i=>i.id).join(',')).join('|');if(s!==signature.current){signature.current=s;setGroups(next);}
  }
  discover();const observer=new MutationObserver(discover);observer.observe(main,{childList:true,subtree:true});return()=>{observer.disconnect();signature.current='';};
 },[pathname]);
 useEffect(()=>{for(const g of groups){g.element.classList.add('bank-layout-container');if(getComputedStyle(g.element).display==='block')g.element.classList.add('bank-layout-stack');const ids=reconcileOrder(preferences.layout_orders[g.id]||[],g.items.map(i=>i.id));g.items.forEach(item=>{item.element.style.order=String(ids.indexOf(item.id));item.element.dataset.dragGroup=g.id;item.element.dataset.dragId=item.id;item.element.classList.toggle('bank-layout-editable',organizing);});}
  return()=>{for(const g of groups){g.element.classList.remove('bank-layout-container','bank-layout-stack');for(const item of g.items){item.element.style.removeProperty('order');item.element.classList.remove('bank-layout-editable');delete item.element.dataset.dragGroup;delete item.element.dataset.dragId;}}};
 },[groups,preferences.layout_orders,organizing]);
 function move(group:string,from:string,to:string){const ids=group==='menu'?orderedMenu(role,preferences.menu_order).map(([k])=>k):reconcileOrder(preferences.layout_orders[group]||[],groups.find(g=>g.id===group)?.items.map(i=>i.id)||[]);const next=moveItem(ids,from,to);void save(group==='menu'?{menu_order:next}:{layout_orders:{[group]:next}}).catch(()=>{});}
 useEffect(()=>{if(!organizing)return;const root=document.querySelector('.bank-app');if(!root)return;
  function target(event:Event){return event.target instanceof Element?event.target.closest<HTMLElement>('[data-drag-group][data-drag-id]'):null;}
  function over(event:Event){const e=event as globalThis.DragEvent;if(!e.dataTransfer?.types.includes('application/ia-bank-layout'))return;e.preventDefault();e.dataTransfer.dropEffect='move';root!.querySelectorAll('.bank-layout-drop').forEach(x=>x.classList.remove('bank-layout-drop'));target(e)?.classList.add('bank-layout-drop');}
  function drop(event:Event){const e=event as globalThis.DragEvent,item=target(e);root!.querySelectorAll('.bank-layout-drop').forEach(x=>x.classList.remove('bank-layout-drop'));delete document.documentElement.dataset.bankDragging;if(!item)return;try{const raw=JSON.parse(e.dataTransfer?.getData('application/ia-bank-layout')||'{}');if(raw.group!==item.dataset.dragGroup)return;e.preventDefault();e.stopPropagation();move(raw.group,raw.id,item.dataset.dragId!);}catch{/* Ignore unrelated drags. */}}
  root.addEventListener('dragover',over);root.addEventListener('drop',drop);return()=>{root.removeEventListener('dragover',over);root.removeEventListener('drop',drop);};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[organizing,groups,preferences.menu_order,preferences.layout_orders,role]);
 return <>{organizing&&<div className="bank-layout-toolbar" role="status"><span>Arraste pela alça “Mover”. Cada conjunto mantém seu tamanho. Sua organização é pessoal.</span><button onClick={()=>{const layouts=Object.fromEntries(groups.map(g=>[g.id,[]]));void save({menu_order:[],layout_orders:layouts}).catch(()=>{});}}><RotateCcw size={14}/> Restaurar esta tela e menu</button>{notice&&<small>{notice}</small>}</div>}{!organizing&&notice.startsWith('Não')&&<p className="bank-layout-notice" role="alert">{notice}</p>}{organizing&&groups.flatMap(g=>g.items.map(item=>createPortal(<BankDragHandle group={g.id} id={item.id} label={item.label} ids={reconcileOrder(preferences.layout_orders[g.id]||[],g.items.map(i=>i.id))} onMove={(from,to)=>move(g.id,from,to)}/>,item.element,'handle-'+g.id+'-'+item.id)))}</>;
}
