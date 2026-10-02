import {db} from './server';
import {validToken} from './experience';
export async function publicExperience(token:string){
 if(!validToken(token))throw new Error('Link inválido. Solicite seu link à Icom.');
 const [row]=await db<{id:string;completed_at:string|null;status:string;expires_at:string|null}[]>(`customer_experiences?token=eq.${token}&select=id,completed_at,status,expires_at`);
 if(!row||row.status==='arquivada'||(row.expires_at&&Date.parse(row.expires_at)<Date.now()))throw new Error('Este link está indisponível. Solicite seu link à Icom.');
 return row;
}
