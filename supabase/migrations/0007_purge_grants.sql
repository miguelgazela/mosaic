-- 0007_purge_grants: lets the milanote-purge edge function (service role) read and delete trash rows. Touches only schema milanote.
-- 0001 only granted schema access to `authenticated`, so the service role got "permission denied for schema milanote".
begin;

grant usage on schema milanote to service_role;
grant select, delete on milanote.boards, milanote.elements, milanote.connections to service_role;

commit;
