'use client';
import {useCallback,useEffect,useRef,useState,type ReactNode,type PointerEvent,type KeyboardEvent,type MouseEvent} from 'react';
type Point={x:number;y:number};
type Drag={id:number;x:number;y:number;left:number;top:number;moved:boolean;previous:Point|null;button:HTMLButtonElement};
const fit=(p:Point,w:number,h:number,vw:number,vh:number):Point=>({x:Math.round(Math.max(8,Math.min(p.x,Math.max(8,vw-w-8)))),y:Math.round(Math.max(8,Math.min(p.y,Math.max(8,vh-h-8))))});
export default function BankAssistantDock({userId,children}:{userId:string;children:ReactNode}){
 const dock=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null),current=useRef<Point|null>(null),suppressClick=useRef(false);
 const [position,setPosition]=useState<Point|null>(null),[dragging,setDragging]=useState(false),storage='ia-bank-assistant-position:'+userId;
 const apply=useCallback((p:Point|null)=>{current.current=p;setPosition(p);},[]);
 function bounded(p:Point){const r=dock.current?.getBoundingClientRect();return fit(p,r?.width||190,r?.height||210,window.innerWidth,window.innerHeight);}
 function persist(p:Point){try{localStorage.setItem(storage,JSON.stringify(p));}catch{/* Movement still works when local storage is disabled. */}}
 useEffect(()=>{
  let disposed=false;
  const boundedHere=(p:Point)=>{const r=dock.current?.getBoundingClientRect();return fit(p,r?.width||190,r?.height||210,window.innerWidth,window.innerHeight);};
  queueMicrotask(()=>{if(disposed)return;try{const p=JSON.parse(localStorage.getItem(storage)||'null') as Point|null;if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0)apply(boundedHere(p));}catch{/* Use the original position. */}});
  const resize=()=>{if(drag.current||!current.current)return;const p=boundedHere(current.current);if(p.x!==current.current.x||p.y!==current.current.y)apply(p);};
  const observer=new ResizeObserver(resize);if(dock.current)observer.observe(dock.current);window.addEventListener('resize',resize);
  return()=>{disposed=true;observer.disconnect();window.removeEventListener('resize',resize);};
 },[storage,apply]);
 function down(e:PointerEvent<HTMLDivElement>){
  if(e.button!==0||!e.isPrimary||drag.current)return;
  const b=e.target instanceof Element?e.target.closest<HTMLButtonElement>('button.bank-voice-launch'):null;if(!b||!dock.current)return;
  const r=dock.current.getBoundingClientRect();suppressClick.current=false;
  drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false,previous:current.current,button:b};b.setPointerCapture(e.pointerId);
 }
 function move(e:PointerEvent<HTMLDivElement>){const d=drag.current;if(!d||d.id!==e.pointerId)return;
  if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;
  d.moved=true;suppressClick.current=true;setDragging(true);e.preventDefault();apply(bounded({x:d.left+e.clientX-d.x,y:d.top+e.clientY-d.y}));
 }
 function finish(e:PointerEvent<HTMLDivElement>,cancel=false){const d=drag.current;if(!d||d.id!==e.pointerId)return;drag.current=null;setDragging(false);
  if(d.moved){if(cancel)apply(d.previous);else{const p=bounded({x:d.left+e.clientX-d.x,y:d.top+e.clientY-d.y});apply(p);persist(p);}suppressClick.current=true;setTimeout(()=>{suppressClick.current=false;},0);}
  if(d.button.hasPointerCapture(e.pointerId))d.button.releasePointerCapture(e.pointerId);
 }
 function click(e:MouseEvent<HTMLDivElement>){if(suppressClick.current&&e.detail>0){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}
 function keys(e:KeyboardEvent<HTMLDivElement>){
  if(!e.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)||!(e.target instanceof Element)||!e.target.closest('.bank-voice-launch')||!dock.current)return;
  e.preventDefault();e.stopPropagation();const r=dock.current.getBoundingClientRect(),step=e.shiftKey?30:10,p=bounded({x:r.left+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y:r.top+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)});apply(p);persist(p);
 }
 return <div ref={dock} data-testid="bank-assistant-dock" className={'bank-assistant-dock'+(dragging?' is-dragging':'')} style={position?{left:position.x,top:position.y,right:'auto'}:undefined} onPointerDown={down} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(drag.current)finish(e,true);}} onClickCapture={click} onKeyDownCapture={keys}>{children}</div>;
}
