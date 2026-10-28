-- 0004_tasks: to-do items across boards (P6). Touches only schema milanote.
begin;

-- Every item of every live to-do card on a live board, flattened. Grouping by due date happens in the client
-- (it knows the user's local "today"). RLS applies: security invoker.
create or replace function milanote.tasks()
returns table (
  element_id uuid,
  board_id uuid,
  board_path jsonb,
  card_title text,
  item_id text,
  item_text text,
  done boolean,
  due text,
  item_pos int
)
language sql stable security invoker set search_path = milanote, pg_temp as $$
  select e.id,
         e.board_id,
         milanote.board_path(e.board_id),
         coalesce(e.content->>'title', ''),
         i.item->>'id',
         coalesce(i.item->>'text', ''),
         coalesce(i.item->>'done', 'false') = 'true',
         nullif(i.item->>'due', ''),
         i.pos::int
  from milanote.elements e
  join milanote.boards b on b.id = e.board_id and b.deleted_at is null
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(e.content->'items') = 'array' then e.content->'items' else '[]'::jsonb end
  ) with ordinality as i(item, pos)
  where e.type = 'todo' and e.deleted_at is null and i.item ? 'id'
  order by e.board_id, e.id, i.pos;
$$;

-- Check / uncheck one item without the client re-sending the whole card. client_id is cleared so open
-- boards (Realtime echo suppression) apply the change.
create or replace function milanote.set_task_done(p_element uuid, p_item text, p_done boolean)
returns void
language sql security invoker set search_path = milanote, pg_temp as $$
  update milanote.elements e
     set content = jsonb_set(
           e.content, '{items}',
           (select coalesce(jsonb_agg(
                     case when t.it->>'id' = p_item then jsonb_set(t.it, '{done}', to_jsonb(p_done)) else t.it end
                     order by t.pos), '[]'::jsonb)
              from jsonb_array_elements(e.content->'items') with ordinality as t(it, pos))),
         client_id = null
   where e.id = p_element and e.type = 'todo' and e.deleted_at is null
     and jsonb_typeof(e.content->'items') = 'array';
$$;

grant execute on function milanote.tasks() to authenticated;
grant execute on function milanote.set_task_done(uuid, text, boolean) to authenticated;

commit;
