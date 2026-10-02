import {db,errorResponse} from '@/lib/server';
import {publicExperience} from '@/lib/public-experience';
export async function POST(req:Request,context:{params:Promise<{token:string}>}){try{
 const {token}=await context.params;const experience=await publicExperience(token);
 if(experience.completed_at)throw new Error('Avaliação já concluída. O registro de garantia é somente leitura.');
 const body=await req.json() as {action:string;session:string;position:number;outcome:string};
 if(body.action==='start')return Response.json({session:await db('rpc/experience_warranty_start','POST',{p_token:token,p_agent:req.headers.get('user-agent')||''})});
 if(body.action==='progress'){
  if(typeof body.position!=='number'||!Number.isFinite(body.position))throw new Error('Progresso inválido.');
  return Response.json({watched_seconds:await db('rpc/experience_warranty_progress','POST',{p_token:token,p_session:body.session,p_position:body.position})});
 }
 if(body.action==='ack')return Response.json({session:await db('rpc/experience_warranty_ack','POST',{p_token:token,p_session:body.session,p_outcome:body.outcome})});
 throw new Error('Ação inválida.');
}catch(e){return errorResponse(e)}}
