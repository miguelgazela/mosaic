-- 0005_connections_client_id: echo suppression for connection sync (P7). Touches only schema milanote.
-- The client writes its own id on every connection row, so it can ignore the Realtime echo of its own writes
-- (same as milanote.elements.client_id).
begin;

alter table milanote.connections add column if not exists client_id text;

commit;
