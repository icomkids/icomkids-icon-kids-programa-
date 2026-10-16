'use client';
import {useRef,useState} from 'react';
import {appPath} from '@/lib/paths';
import {companyName,LOGO_MAX_BYTES,type Branding} from '@/lib/branding';
import {BrandMark,useBranding} from './Branding';
export async function prepareLogo(file:File):Promise<Blob>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Escolha uma logo PNG, JPG ou WebP de até 10 MB.');
 const bitmap=await createImageBitmap(file);try{
  if(!bitmap.width||!bitmap.height)throw new Error('Imagem inválida.');
  const scale=Math.min(1,600/bitmap.width,240/bitmap.height),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('Não foi possível preparar a logo.');
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível preparar a logo.')),'image/png'));
  if(blob.size>LOGO_MAX_BYTES)throw new Error('A logo ficou muito grande. Escolha uma imagem mais simples.');return blob;
 }finally{bitmap.close()}
}
export default function BrandSettings({auth}:{auth:string}){
 const {branding,setBranding}=useBranding(),[name,setName]=useState(branding.company_name),[logo,setLogo]=useState<Blob|null>(null),[preview,setPreview]=useState(branding.logo_url),[remove,setRemove]=useState(false),[busy,setBusy]=useState(false),[preparing,setPreparing]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const reader=useRef(0);
 async function choose(file:File){const revision=++reader.current;setPreparing(true);setError('');setMessage('');try{const blob=await prepareLogo(file),data=await new Promise<string>((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result));fr.onerror=()=>reject(new Error('Não foi possível abrir a imagem.'));fr.readAsDataURL(blob)});if(revision!==reader.current)return;setLogo(blob);setPreview(data);setRemove(false);}catch(e){if(revision===reader.current)setError(e instanceof Error?e.message:'Não foi possível abrir a logo.')}finally{if(revision===reader.current)setPreparing(false)}}
 return <section className="panel brand-settings"><div className="brand-settings-heading"><p className="eyebrow">A IDENTIDADE DO SEU NEGÓCIO</p><h2>Marca da empresa</h2><p>Personalize a experiência com o nome e a logo da sua empresa. As alterações valem para todo este sistema: painel, vendedores e clientes.</p></div><div className="brand-settings-grid"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{const form=new FormData();form.set('company_name',companyName(name));if(logo)form.set('logo',logo,'logo.png');if(remove)form.set('remove_logo','true');const response=await fetch(appPath('/api/admin/branding'),{method:'POST',headers:{Authorization:`Bearer ${auth}`},body:form});const data=await response.json() as {branding?:Branding;error?:string};if(!response.ok||!data.branding)throw new Error(data.error||'Não foi possível salvar a marca.');setBranding(data.branding);setName(data.branding.company_name);setPreview(data.branding.logo_url);setLogo(null);setRemove(false);setMessage('Marca salva. O nome e a logo já aparecem no painel e na experiência do cliente.');}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.')}finally{setBusy(false)}}}>
 <label>Nome da empresa<input name="company_name" value={name} required maxLength={80} disabled={busy||preparing} onChange={e=>{setName(e.target.value);setMessage('')}} placeholder="Ex.: Sua Empresa"/></label>
 <label>Enviar ou trocar a logo<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" disabled={busy||preparing} onChange={e=>{const file=e.target.files?.[0];if(file)void choose(file);e.target.value=''}}/><small>PNG, JPG ou WebP, até 10 MB. A proporção e a transparência serão preservadas.</small></label>
 {preview&&<button type="button" disabled={busy||preparing} onClick={()=>{reader.current++;setLogo(null);setPreview(null);setRemove(true);setMessage('')}}>Remover logo</button>}
 <button className="primary" disabled={busy||preparing}>{preparing?'PREPARANDO LOGO…':busy?'SALVANDO…':'SALVAR MARCA'}</button>
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="brand-saved" role="status">{message}</p>}
 </form><aside className="brand-preview"><p className="eyebrow">PRÉVIA DA SUA MARCA</p><div><BrandMark branding={{company_name:name.trim()||'Sua empresa',logo_url:preview}}/></div><small>Assim sua empresa aparece para o cliente.</small></aside></div><div className="brand-link-note"><h3>Nome da aba e do link</h3><p>O sistema se apresenta como <strong>Experiência</strong>. O nome da empresa aparece na identificação da marca.</p><p>Para usar um endereço sem “icomkids”, é necessário configurar um domínio próprio na hospedagem. Alterar a marca aqui mantém os links já enviados funcionando.</p></div></section>
}
