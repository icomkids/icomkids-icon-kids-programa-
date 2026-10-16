-- Branding is scoped to this installation's existing singleton settings.
-- Keep existing RLS and grants: only server service_role may access settings.
alter table public.experience_settings add column if not exists logo_data_url text
 check (logo_data_url is null or (length(logo_data_url)<=409622 and logo_data_url ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'));
