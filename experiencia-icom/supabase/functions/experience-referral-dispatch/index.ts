// Custom secret authentication; neither secrets nor customer data appear in responses.
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=req.headers.get('x-experience-cron');if(!secret||secret.length!==64)return new Response('Unauthorized',{status:401});
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const auth=await fetch(`${url}/rest/v1/rpc/experience_reminder_authorize`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_secret:secret})});
 if(!auth.ok||await auth.json()!==true)return new Response('Unauthorized',{status:401});
 try{
  const response=await fetch('https://sistema.icomkids.com.br/experiencia-icom/api/internal/referral-reminders',{method:'POST',headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(140000),redirect:'error'});
  return new Response(response.ok?'Dispatch completed':'Dispatch unavailable',{status:response.ok?200:503});
 }catch{return new Response('Dispatch unavailable',{status:503})}
});
