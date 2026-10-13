-- Run ONCE per project, in the SQL editor, after the send-reminders function is deployed.
-- It calls the function every 5 minutes. The secret lives in Vault, never in this file.
--
-- 1. Choose a long random value for CRON_SECRET and give it to BOTH sides:
--      supabase secrets set CRON_SECRET=<value> --project-ref <ref>
--      select vault.create_secret('<value>', 'send_reminders_cron_secret');
-- 2. Replace <ref> below with the project ref, then run this file.
-- Reminders stay a DRY RUN (nothing is sent) until you also run:
--      supabase secrets set SMS_LIVE=true SEMAPHORE_API_KEY=<key> --project-ref <ref>

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'send_reminders_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To stop sending at any time:  select cron.unschedule('send-reminders');
-- Recent runs:                  select * from cron.job_run_details order by start_time desc limit 10;
