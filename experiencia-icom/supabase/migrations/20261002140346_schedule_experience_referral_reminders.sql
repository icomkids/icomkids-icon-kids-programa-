select cron.schedule('experience-referral-reminders','*/15 * * * *',$job$
 select net.http_post(
  url:='https://swsfwthjxtqtkloexyjs.supabase.co/functions/v1/experience-referral-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','x-experience-cron',(select decrypted_secret from vault.decrypted_secrets where name='experience_referral_cron' limit 1)),
  body:='{}'::jsonb,
  timeout_milliseconds:=150000
 );
 $job$);
