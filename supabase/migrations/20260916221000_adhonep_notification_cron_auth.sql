-- The notification processor validates a legacy Supabase JWT. Keep the cron
-- credential in Vault so it is never exposed to the browser application.
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3c2Z3dGhqeHRxdGtsb2V4eWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzkxOTMsImV4cCI6MjA5Mzc1NTE5M30.09EL5hjdfzK-THVcnakg1nCSAeDMC99gSNUCumku3_4',
  'adhonep_anon_jwt',
  'JWT anon usado exclusivamente pelo cron de notificacoes ADHONEP'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'adhonep_anon_jwt'
);

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'adhonep-process-emails';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'adhonep-process-emails',
  '*/5 * * * *',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'adhonep_project_url') || '/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'adhonep_anon_jwt')
    ),
    body := '{}'::jsonb
  );$$
);
