import {authorize,config,errorResponse,log} from '@/lib/server';
export async function POST(req:Request){try{
 const actor=await authorize();if(!['owner','admin'].includes(actor.role))throw new Error('Acesso não autorizado.');
 const form=await req.formData(),file=form.get('video');
 if(!(file instanceof File)||file.type!=='video/mp4'||!file.name.toLowerCase().endsWith('.mp4')||file.size<=0||file.size>50*1024*1024)throw new Error('Selecione um vídeo MP4 de até 50 MB.');
 const {url,key}=config();const headers={apikey:key,Authorization:`Bearer ${key}`};const bucket='experience-warranty';
 const existing=await fetch(`${url}/storage/v1/bucket/${bucket}`,{headers,cache:'no-store'});
 if(!existing.ok&&existing.status!==404&&existing.status!==400)throw new Error('Não foi possível consultar o armazenamento do vídeo.');
 if(!existing.ok){const created=await fetch(`${url}/storage/v1/bucket`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:bucket,name:bucket,public:true,file_size_limit:50*1024*1024,allowed_mime_types:['video/mp4']})});if(!created.ok&&created.status!==409)throw new Error('Não foi possível preparar o armazenamento do vídeo.');}
 const name=`${crypto.randomUUID()}.mp4`;const uploaded=await fetch(`${url}/storage/v1/object/${bucket}/${name}`,{method:'POST',headers:{...headers,'Content-Type':'video/mp4','Cache-Control':'public,max-age=31536000,immutable','x-upsert':'false'},body:file,signal:AbortSignal.timeout(180000)});
 if(!uploaded.ok)throw new Error('Não foi possível enviar o vídeo. Confira o tamanho e tente novamente.');
 await log(actor.id,'warranty_video_uploaded',name);
 return Response.json({url:`${url}/storage/v1/object/public/${bucket}/${name}`});
}catch(e){return errorResponse(e)}}
