-- 0009_share_grants: lets the milanote-share edge function (service role) read share links. Touches only schema milanote.
-- boards, elements and connections were already granted to service_role by 0007_purge_grants.
begin;

grant usage on schema milanote to service_role;
grant select on milanote.shares to service_role;

commit;
