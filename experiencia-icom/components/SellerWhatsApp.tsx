'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
import {appPath} from '@/lib/paths';
import type {Connection} from '@/lib/whatsapp';
export default function SellerWhatsApp({auth,value,onChange}:{auth:string;value:Connection;onChange:(value:Connection)=>void}){
 const [phone,setPhone]=useState(value.phone||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function update(connect=false){setBusy(true);setError('');try{const r=await fetch(appPath('/api/admin/whatsapp'),{method:connect?'POST':'GET',headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},...(connect?{body:JSON.stringify({connect:true,phone})}:{})});const data=await r.json() as {error?:string;connection:Connection};if(!r.ok)throw new Error(data.error||'Não foi possível conectar.');onChange(data.connection);}catch(e){setError(e instanceof Error?e.message:'Não foi possível conectar.');}finally{setBusy(false)}}
 useEffect(()=>{if(!value.connecting&&!value.qr&&!value.paircode)return;let active=true;const timer=setInterval(()=>{if(document.hidden)return;void fetch(appPath('/api/admin/whatsapp'),{headers:{Authorization:`Bearer ${auth}`}}).then(async r=>{if(r.ok){const data=await r.json() as {error?:string;connection:Connection};if(active)onChange(data.connection)}}).catch(()=>{})},8000);return()=>{active=false;clearInterval(timer)}},[auth,value.connecting,value.qr,value.paircode,onChange]);
 return <section className="panel seller-connection"><p className="eyebrow">ENVIE PELO SEU PRÓPRIO NÚMERO</p><h1>Meu WhatsApp</h1><p>{value.message}</p>{value.connected?<p className="seller-notice">✓ Conectado: +{value.phone}</p>:<><label>Seu número de WhatsApp com DDD<input type="tel" inputMode="tel" maxLength={22} value={phone} onChange={e=>setPhone(e.target.value)} readOnly={!!value.phone} placeholder="(12) 99999-9999"/></label><button className="primary" disabled={busy||value.connecting||value.wrongNumber||(!value.configured&&!value.canProvision)} onClick={()=>void update(true)}>{busy?'PREPARANDO…':value.connecting?'AGUARDANDO LEITURA DO QR CODE':'GERAR QR CODE'}</button></>}
 <button disabled={busy} onClick={()=>void update()}>Atualizar conexão</button>
 {error&&<p role="alert" className="error">{error}</p>}
 {value.qr&&<Image className="seller-qr" src={value.qr} width={240} height={240} unoptimized alt="QR Code para conectar seu WhatsApp"/>}
 {value.paircode&&<p>Código de conexão: <b>{value.paircode}</b></p>}
 {!value.connected&&<ol><li>Abra o WhatsApp no seu celular.</li><li>Toque em Dispositivos conectados → Conectar um dispositivo.</li><li>Escaneie o QR Code exibido aqui no computador.</li><li>Aguarde a confirmação “Conectado”.</li></ol>}
 <p>As pesquisas dos seus clientes serão enviadas por esse número. Mantenha o WhatsApp conectado para os envios automáticos.</p>
 </section>
}
