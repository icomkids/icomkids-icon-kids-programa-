import {db,errorResponse} from '@/lib/server';
import {publicExperience} from '@/lib/public-experience';
import {phoneBR} from '@/lib/whatsapp';
export async function POST(req:Request,context:{params:Promise<{token:string}>}){try{
 const {token}=await context.params;await publicExperience(token);const body=await req.json() as {action?:string;name:string;phone:string;permission:boolean};
 if(body.action==='cancel'){await db('rpc/experience_referral_cancel','POST',{p_token:token});return Response.json({ok:true});}
 const name=String(body.name||'').trim();if(name.length<2||name.length>120||body.permission!==true)throw new Error('Informe o nome e confirme a autorização da pessoa indicada.');
 await db('rpc/experience_referral_add','POST',{p_token:token,p_name:name,p_phone:phoneBR(body.phone),p_permission:true});
 return Response.json({ok:true});
}catch(e){return errorResponse(e)}}
