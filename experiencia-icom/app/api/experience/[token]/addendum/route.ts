import {db,errorResponse} from '@/lib/server';
import {publicExperience} from '@/lib/public-experience';
import {validToken} from '@/lib/experience';
import type {AddendumReceipt} from '@/lib/sale-addendum';
export async function POST(req:Request,context:{params:Promise<{token:string}>}){try{
 const {token}=await context.params;const experience=await publicExperience(token);
 if(experience.completed_at)throw Error('Avaliação concluída. A ciência registrada é somente leitura.');
 const body=await req.json() as {addendum_id:unknown;outcome:unknown;read:unknown};
 if(typeof body.addendum_id!=='string'||!validToken(body.addendum_id)||!['agreed','questions'].includes(String(body.outcome))||body.read!==true)throw Error('Leia o adendo e selecione sua resposta.');
 const receipt=await db<AddendumReceipt>('rpc/experience_addendum_ack','POST',{p_token:token,p_addendum:body.addendum_id,p_outcome:body.outcome,p_read:true,p_agent:req.headers.get('user-agent')||''});
 return Response.json({receipt});
}catch(e){return errorResponse(e)}}
