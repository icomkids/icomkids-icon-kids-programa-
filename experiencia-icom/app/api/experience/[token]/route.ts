import { db, errorResponse } from '@/lib/server';
import { Answers, alertRule, assertEditable, category, sanitizeAnswers, validToken } from '@/lib/experience';
interface PublicRecord {id:string;status:string;completed_at:string|null;expires_at:string|null;customers:{name:string};experience_responses:{answers:Answers}[]}
async function load(token: string) {
  if(!validToken(token)) throw new Error('Este link não é válido. Solicite um novo link à Icom.');
  const [row] = await db<PublicRecord[]>(`customer_experiences?token=eq.${token}&select=id,status,completed_at,expires_at,customers(name),experience_responses(answers)`);
  if(!row) throw new Error('Experiência não encontrada. Solicite seu link à Icom.');
  if(row.status === 'arquivada') throw new Error('Este link foi arquivado. Solicite um novo link à Icom.');
  if(row.expires_at && Date.parse(row.expires_at) < Date.now()) throw new Error('Este link expirou. Solicite um novo link à Icom.');
  const [settings] = await db<Record<string,unknown>[]>('experience_settings?id=eq.1');
  if(!settings?.survey_active) throw new Error('A pesquisa está temporariamente indisponível.');
  return {row,settings};
}
export async function GET(_:Request, context:{params:Promise<{token:string}>}) {
  try { const {token}=await context.params; const {row,settings}=await load(token);
    await db('rpc/experience_open','POST',{p_token:token});
    return Response.json({name:row.customers.name.split(' ')[0],completed:!!row.completed_at,answers:row.experience_responses[0]?.answers || {},settings:{google_review_url:settings.google_review_url,intro_text:settings.intro_text,final_text:settings.final_text,estimated_time:settings.estimated_time}});
  } catch(e) {return errorResponse(e);}
}
export async function POST(req:Request,context:{params:Promise<{token:string}>}) {
  try {const {token}=await context.params; const {row}=await load(token);
    if(row.completed_at) return Response.json({error:'Obrigado. Sua avaliação já foi registrada.'},{status:409});
    assertEditable(row);
    const body=await req.json() as {answers:Answers;complete:boolean};
    if(!body || typeof body.answers!=='object' || !body.answers || Array.isArray(body.answers)) throw new Error('Não foi possível salvar. Atualize a página e tente novamente.');
    const answers=sanitizeAnswers(body.answers,body.complete === true);
    const alert=alertRule(answers);
    await db('rpc/experience_save','POST',{p_token:token,p_answers:answers,p_complete:body.complete === true,p_nps:body.complete ? answers.nps_score : null,p_category:body.complete ? category(Number(answers.nps_score)) : null,p_alert:body.complete ? alert.level : 'none',p_reason:alert.reasons.join('; ')});
    return Response.json({ok:true});
  } catch(e) {return errorResponse(e);}
}
