import { config, errorResponse } from '@/lib/server';
export async function POST(req:Request) {try {const {url,key}=config(); const {email,password}=await req.json() as {email:string;password:string};
  const res=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!res.ok) throw new Error('E-mail ou senha inválidos.'); const data=await res.json() as {access_token:string;refresh_token:string;expires_in:number};
  return Response.json({access_token:data.access_token,refresh_token:data.refresh_token,expires_in:data.expires_in});
}catch(e){return errorResponse(e);}}
