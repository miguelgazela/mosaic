-- 0006_board_management: move cards between boards, duplicate boards, trash (P8). Touches only schema milanote.
-- Run once in the SQL Editor (needs 0001 and 0005 first). Safe to re-run: functions are `create or replace`,
-- the trigger is dropped and recreated.
begin;

-- A board and every board below it (live or trashed; callers filter).
create or replace function milanote.board_subtree(p_root uuid)
returns setof uuid
language sql stable security invoker set search_path = milanote, pg_temp as $$
  with recursive t(id) as (
    select b.id from milanote.boards b where b.id = p_root
    union all
    select b.id from milanote.boards b join t on b.parent_board_id = t.id
  )
  select id from t;
$$;

-- move_elements ---------------------------------------------------------------------------------------------
-- Moves cards (plus the cards inside any moved column) to another board. Lines between moved cards go along;
-- lines that join a moved card to a card left behind are soft-deleted. Board cards re-parent their child board.
-- p_at_x / p_at_y = where the top-left of the moved group lands; null = below the existing content of the target.
-- Layout inside the group is kept, so moving back with the old top-left restores the exact positions (Undo).
create or replace function milanote.move_elements(
  p_ids uuid[], p_target uuid,
  p_at_x double precision default null, p_at_y double precision default null
) returns void
language plpgsql security invoker set search_path = milanote, pg_temp as $$
declare
  moved uuid[];
  src uuid;
  minx double precision;
  miny double precision;
  ax double precision := p_at_x;
  ay double precision := p_at_y;
  dx double precision;
  dy double precision;
  ts timestamptz := now();
begin
  if not exists (select 1 from milanote.boards where id = p_target and deleted_at is null) then
    raise exception 'target board not found' using errcode = 'P0002';
  end if;

  select array_agg(e.id) into moved from milanote.elements e
   where e.deleted_at is null and (e.id = any(p_ids) or e.parent_id = any(p_ids));
  if moved is null then return; end if;

  select e.board_id into src from milanote.elements e where e.id = moved[1];
  if exists (select 1 from milanote.elements e where e.id = any(moved) and e.board_id <> src) then
    raise exception 'cards come from different boards' using errcode = '22023';
  end if;
  if src = p_target then return; end if;

  -- A board cannot move into itself or into a board below it.
  if exists (
    select 1 from milanote.elements e
     where e.id = any(moved) and e.type = 'board' and nullif(e.content->>'boardId', '') is not null
       and exists (select 1 from milanote.board_subtree((e.content->>'boardId')::uuid) s where s = p_target)
  ) then
    raise exception 'cannot move a board into itself' using errcode = '22023';
  end if;

  select min(e.x), min(e.y) into minx, miny from milanote.elements e
   where e.id = any(moved) and (e.parent_id is null or not (e.parent_id = any(moved)));

  if ax is null or ay is null then
    select coalesce(min(e.x), 80), coalesce(max(e.y + coalesce(e.height, 160)) + 32, 80) into ax, ay
      from milanote.elements e where e.board_id = p_target and e.deleted_at is null and e.parent_id is null;
  end if;
  dx := ax - minx;
  dy := ay - miny;

  -- Lines first (they still point at src while the cards are still there).
  update milanote.connections c set
    board_id = p_target,
    client_id = null,
    from_point = case when c.from_element_id is null and c.from_point ? 'x'
      then jsonb_build_object('x', (c.from_point->>'x')::double precision + dx, 'y', (c.from_point->>'y')::double precision + dy)
      else c.from_point end,
    to_point = case when c.to_element_id is null and c.to_point ? 'x'
      then jsonb_build_object('x', (c.to_point->>'x')::double precision + dx, 'y', (c.to_point->>'y')::double precision + dy)
      else c.to_point end
   where c.board_id = src and c.deleted_at is null
     and (c.from_element_id = any(moved) or c.to_element_id = any(moved))
     and (c.from_element_id is null or c.from_element_id = any(moved))
     and (c.to_element_id is null or c.to_element_id = any(moved));
  update milanote.connections c set deleted_at = ts, client_id = null
   where c.board_id = src and c.deleted_at is null
     and (c.from_element_id = any(moved) or c.to_element_id = any(moved));

  update milanote.elements e set
    board_id = p_target,
    client_id = null,
    parent_id = case when e.parent_id = any(moved) then e.parent_id else null end,
    sort_key = case when e.parent_id = any(moved) then e.sort_key else null end,
    x = case when e.parent_id = any(moved) then e.x else e.x + dx end,
    y = case when e.parent_id = any(moved) then e.y else e.y + dy end
   where e.id = any(moved);

  update milanote.boards b set parent_board_id = p_target
   where b.is_home = false and b.id in (
     select nullif(e.content->>'boardId', '')::uuid from milanote.elements e where e.id = any(moved) and e.type = 'board'
   );
end $$;

-- trash_board / restore_board -------------------------------------------------------------------------------
-- Trashing a board trashes the whole subtree with one timestamp and takes the board's card in the parent along.
-- Restoring brings back exactly what went to the trash with it (same timestamp); children that were trashed
-- earlier stay in the trash. Home cannot be trashed.
create or replace function milanote.trash_board(p_board uuid)
returns void
language plpgsql security invoker set search_path = milanote, pg_temp as $$
declare
  ts timestamptz := now();
  home boolean;
begin
  select b.is_home into home from milanote.boards b where b.id = p_board and b.deleted_at is null;
  if not found then return; end if;
  if home then raise exception 'Home cannot be moved to the trash' using errcode = '22023'; end if;
  update milanote.boards set deleted_at = ts
   where id in (select milanote.board_subtree(p_board)) and deleted_at is null;
  update milanote.elements set deleted_at = ts, client_id = null
   where type = 'board' and deleted_at is null and content->>'boardId' = p_board::text;
end $$;

create or replace function milanote.restore_board(p_board uuid)
returns void
language plpgsql security invoker set search_path = milanote, pg_temp as $$
declare
  ts timestamptz;
  parent uuid;
begin
  select b.deleted_at, b.parent_board_id into ts, parent from milanote.boards b where b.id = p_board;
  if ts is null then return; end if;
  if parent is not null and exists (select 1 from milanote.boards p where p.id = parent and p.deleted_at is not null) then
    raise exception 'the board it was in is in the trash' using errcode = 'P0001';
  end if;
  update milanote.boards set deleted_at = null
   where id in (select milanote.board_subtree(p_board)) and deleted_at = ts;
  update milanote.elements set deleted_at = null, client_id = null
   where type = 'board' and deleted_at is not null and content->>'boardId' = p_board::text;
end $$;

-- Deleting a board card (Delete key, cut, undo of a paste …) sends its child board to the trash too; bringing the
-- card back (undo) restores the board. Without this the child board would live on with no way in.
create or replace function milanote.element_board_trash_sync()
returns trigger
language plpgsql security invoker set search_path = milanote, pg_temp as $$
declare child uuid := nullif(new.content->>'boardId', '')::uuid;
begin
  if child is null then return new; end if;
  if old.deleted_at is null and new.deleted_at is not null then
    perform milanote.trash_board(child);
  elsif old.deleted_at is not null and new.deleted_at is null then
    perform milanote.restore_board(child);
  end if;
  return new;
end $$;

drop trigger if exists elements_board_trash on milanote.elements;
create trigger elements_board_trash after update on milanote.elements
  for each row when (new.type = 'board' and old.deleted_at is distinct from new.deleted_at)
  execute function milanote.element_board_trash_sync();

-- duplicate_board -------------------------------------------------------------------------------------------
-- Deep copy: sub-boards, cards, lines. Storage paths in image/file cards are reused (objects are shared;
-- milanote-purge only removes objects no card references). The copy is called "<title> copy".
-- p_new_id lets the client choose the id up front (paste / duplicate of a board card). p_with_card adds a board
-- card for the copy to p_target_parent, next to the original's card (Duplicate board in the board menu).
-- The source may be in the trash (cut then paste): rows trashed together with it are copied too.
create or replace function milanote.duplicate_board(
  p_board uuid, p_target_parent uuid,
  p_new_id uuid default null, p_with_card boolean default false
) returns uuid
language plpgsql security invoker set search_path = milanote, pg_temp as $$
declare
  v_new uuid := coalesce(p_new_id, gen_random_uuid());
  v_root_deleted timestamptz;
  v_home boolean;
  v_card milanote.elements%rowtype;
begin
  select b.deleted_at, b.is_home into v_root_deleted, v_home from milanote.boards b where b.id = p_board;
  if not found then raise exception 'board not found' using errcode = 'P0002'; end if;
  if v_home then raise exception 'Home cannot be duplicated' using errcode = '22023'; end if;
  if not exists (select 1 from milanote.boards where id = p_target_parent and deleted_at is null) then
    raise exception 'target board not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from milanote.board_subtree(p_board) s where s = p_target_parent) then
    raise exception 'cannot duplicate a board into itself' using errcode = '22023';
  end if;

  with recursive tree(id) as (
    select p_board
    union all
    select b.id from milanote.boards b join tree t on b.parent_board_id = t.id
     where b.deleted_at is null or b.deleted_at = v_root_deleted
  ),
  bmap as materialized (
    select t.id as old_id, case when t.id = p_board then v_new else gen_random_uuid() end as new_id from tree t
  ),
  emap as materialized (
    select e.id as old_id, gen_random_uuid() as new_id
      from milanote.elements e
      join tree t on e.board_id = t.id
      left join bmap cb on e.type = 'board' and cb.old_id = nullif(e.content->>'boardId', '')::uuid
     where e.deleted_at is null and (e.type <> 'board' or cb.new_id is not null)
  ),
  new_boards as (
    insert into milanote.boards (id, owner_id, parent_board_id, title, icon, color, viewport)
    select bm.new_id, auth.uid(),
           case when b.id = p_board then p_target_parent else pm.new_id end,
           case when b.id = p_board then b.title || ' copy' else b.title end,
           b.icon, b.color, b.viewport
      from milanote.boards b
      join bmap bm on bm.old_id = b.id
      left join bmap pm on pm.old_id = b.parent_board_id
    returning id
  ),
  new_elements as (
    insert into milanote.elements (id, board_id, owner_id, type, parent_id, x, y, width, height, z, sort_key, color, content, plain_text)
    select em.new_id, bm.new_id, auth.uid(), e.type, pe.new_id, e.x, e.y, e.width, e.height, e.z, e.sort_key, e.color,
           case when e.type = 'board'
                then jsonb_set(e.content, '{boardId}', to_jsonb(cb.new_id::text))
                else e.content end,
           e.plain_text
      from milanote.elements e
      join emap em on em.old_id = e.id
      join bmap bm on bm.old_id = e.board_id
      left join emap pe on pe.old_id = e.parent_id
      left join bmap cb on e.type = 'board' and cb.old_id = nullif(e.content->>'boardId', '')::uuid
    returning id
  )
  insert into milanote.connections (board_id, owner_id, from_element_id, to_element_id, from_point, to_point, style, label)
  select bm.new_id, auth.uid(), fm.new_id, tm.new_id, c.from_point, c.to_point, c.style, c.label
    from milanote.connections c
    join bmap bm on bm.old_id = c.board_id
    left join emap fm on fm.old_id = c.from_element_id
    left join emap tm on tm.old_id = c.to_element_id
   where c.deleted_at is null
     and (c.from_element_id is null or fm.new_id is not null)
     and (c.to_element_id is null or tm.new_id is not null);

  if p_with_card then
    select * into v_card from milanote.elements e
     where e.board_id = p_target_parent and e.type = 'board' and e.deleted_at is null
       and e.content->>'boardId' = p_board::text
     limit 1;
    if found then
      insert into milanote.elements (board_id, owner_id, type, x, y, width, z, content)
      values (p_target_parent, auth.uid(), 'board', v_card.x + v_card.width + 24, v_card.y, v_card.width,
              v_card.z || 'V', jsonb_build_object('boardId', v_new));
    else
      insert into milanote.elements (board_id, owner_id, type, x, y, width, content)
      select p_target_parent, auth.uid(), 'board', coalesce(min(e.x), 80), coalesce(max(e.y + coalesce(e.height, 160)) + 32, 80), 136,
             jsonb_build_object('boardId', v_new)
        from milanote.elements e where e.board_id = p_target_parent and e.deleted_at is null and e.parent_id is null;
    end if;
  end if;

  return v_new;
end $$;

-- Trash page -------------------------------------------------------------------------------------------------
-- What the trash page lists: boards whose parent is live (their sub-boards go with them) and cards whose board
-- is live. Board cards are not listed; their board is.
create or replace function milanote.trash_items()
returns table (
  kind text, id uuid, type text, title text, item_count int, icon text, color text,
  content jsonb, plain_text text, was_in jsonb, deleted_at timestamptz
)
language sql stable security invoker set search_path = milanote, pg_temp as $$
  select 'board'::text, b.id, 'board'::text, b.title,
         (select count(*)::int from milanote.elements e where e.board_id = b.id and e.deleted_at is null),
         b.icon, b.color, null::jsonb, null::text, milanote.board_path(b.parent_board_id), b.deleted_at
    from milanote.boards b
    join milanote.boards p on p.id = b.parent_board_id and p.deleted_at is null
   where b.deleted_at is not null
  union all
  select 'element'::text, e.id, e.type::text, '', 0, null::text, e.color,
         e.content, e.plain_text, milanote.board_path(e.board_id), e.deleted_at
    from milanote.elements e
    join milanote.boards b on b.id = e.board_id and b.deleted_at is null
    left join milanote.elements par on par.id = e.parent_id
   where e.deleted_at is not null and e.type <> 'board'
     and (e.parent_id is null or par.deleted_at is null)
  order by 11 desc;
$$;

-- Bring a trashed card back, with the cards and lines that were deleted with it (within 5 s of it).
create or replace function milanote.restore_element(p_id uuid)
returns void
language plpgsql security invoker set search_path = milanote, pg_temp as $$
declare
  ts timestamptz;
  bid uuid;
begin
  select e.deleted_at, e.board_id into ts, bid from milanote.elements e where e.id = p_id;
  if ts is null then return; end if;
  if not exists (select 1 from milanote.boards b where b.id = bid and b.deleted_at is null) then
    raise exception 'the board it was in is in the trash' using errcode = 'P0001';
  end if;
  update milanote.elements e set deleted_at = null, client_id = null
   where e.id = p_id or (e.parent_id = p_id and e.deleted_at is not null and abs(extract(epoch from e.deleted_at - ts)) < 5);
  update milanote.connections c set deleted_at = null, client_id = null
   where c.deleted_at is not null and abs(extract(epoch from c.deleted_at - ts)) < 5
     and (c.from_element_id = p_id or c.to_element_id = p_id)
     and (c.from_element_id is null or exists (select 1 from milanote.elements e where e.id = c.from_element_id and e.deleted_at is null))
     and (c.to_element_id is null or exists (select 1 from milanote.elements e where e.id = c.to_element_id and e.deleted_at is null));
end $$;

-- Permanently remove one trashed board (with its sub-boards, cards and lines: foreign keys cascade) or card.
-- Storage objects stay until milanote-purge finds nothing references them.
create or replace function milanote.delete_forever(p_kind text, p_id uuid)
returns void
language plpgsql security invoker set search_path = milanote, pg_temp as $$
begin
  if p_kind = 'board' then
    delete from milanote.elements where type = 'board' and deleted_at is not null and content->>'boardId' = p_id::text;
    delete from milanote.boards where id = p_id and deleted_at is not null and is_home = false;
  elsif p_kind = 'element' then
    delete from milanote.elements where id = p_id and deleted_at is not null;
  else
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
end $$;

grant execute on function milanote.board_subtree(uuid) to authenticated;
grant execute on function milanote.move_elements(uuid[], uuid, double precision, double precision) to authenticated;
grant execute on function milanote.trash_board(uuid) to authenticated;
grant execute on function milanote.restore_board(uuid) to authenticated;
grant execute on function milanote.duplicate_board(uuid, uuid, uuid, boolean) to authenticated;
grant execute on function milanote.trash_items() to authenticated;
grant execute on function milanote.restore_element(uuid) to authenticated;
grant execute on function milanote.delete_forever(text, uuid) to authenticated;

commit;
