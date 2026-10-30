-- 0010_set_task_due: set / clear the due date of one to-do item from the Tasks list (P13). Touches only schema milanote.
-- Run after 0004. Safe to run twice.
begin;

-- p_due is an ISO date ('2026-11-03') or null / '' to clear. Same shape and security as set_task_done:
-- security invoker (RLS applies), client_id cleared so open boards apply the change over Realtime.
create or replace function milanote.set_task_due(p_element uuid, p_item text, p_due text)
returns void
language sql security invoker set search_path = milanote, pg_temp as $$
  update milanote.elements e
     set content = jsonb_set(
           e.content, '{items}',
           (select coalesce(jsonb_agg(
                     case when t.it->>'id' = p_item then
                       case when nullif(p_due, '') is null then t.it - 'due'
                            else jsonb_set(t.it, '{due}', to_jsonb(p_due)) end
                     else t.it end
                     order by t.pos), '[]'::jsonb)
              from jsonb_array_elements(e.content->'items') with ordinality as t(it, pos))),
         client_id = null
   where e.id = p_element and e.type = 'todo' and e.deleted_at is null
     and jsonb_typeof(e.content->'items') = 'array'
     and (nullif(p_due, '') is null or p_due ~ '^\d{4}-\d{2}-\d{2}$');
$$;

grant execute on function milanote.set_task_due(uuid, text, text) to authenticated;

commit;
