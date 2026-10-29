-- 0008_search: global search (P10). Touches only schema milanote.
begin;

-- Board titles + card text. Security invoker: RLS decides what the caller sees.
-- Words are matched as prefixes ("shot li" finds "shot list"); every word must match.
-- Snippets mark matches with U+E000 (start) and U+E001 (end), a private-use pair the client turns into highlights.
-- Trashed cards, cards in trashed columns and trashed boards (with everything below them) are skipped.
-- kind 'board': id = board id, board_path = path to its parent. kind 'element': id = card id, board_id = where it is.
create or replace function milanote.search(q text, lim int default 30)
returns table (
  kind text,
  id uuid,
  board_id uuid,
  type text,
  title text,
  snippet text,
  board_path jsonb,
  icon text,
  color text,
  rank real
)
language plpgsql stable security invoker set search_path = milanote, pg_temp as $$
declare
  tq tsquery;
  words text[];
  pat text;
  n int := least(greatest(coalesce(lim, 30), 1), 100);
  opts constant text := 'StartSel=' || U&'\E000' || ', StopSel=' || U&'\E001' || ', MaxFragments=1, MinWords=6, MaxWords=18, ShortWord=1';
begin
  words := array(select w from regexp_split_to_table(lower(coalesce(q, '')), '[^[:alnum:]]+') as w where w <> '');
  if cardinality(words) = 0 then return; end if;
  tq := to_tsquery('simple', (select string_agg(quote_literal(w) || ':*', ' & ') from unnest(words) as w));
  pat := '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    (select 'board'::text, b.id, b.id, 'board'::text, b.title,
            ts_headline('simple', b.title, tq, opts),
            milanote.board_path(b.parent_board_id), b.icon, b.color,
            ts_rank(to_tsvector('simple', b.title), tq)
       from milanote.boards b
      where b.deleted_at is null and not b.is_home
        and (to_tsvector('simple', b.title) @@ tq or b.title ilike pat)
      order by 10 desc, b.title
      limit n)
    union all
    (select 'element'::text, e.id, e.board_id, e.type::text, '',
            ts_headline('simple', e.plain_text, tq, opts),
            milanote.board_path(e.board_id), null::text, e.color,
            ts_rank(e.search, tq)
       from milanote.elements e
       join milanote.boards b on b.id = e.board_id and b.deleted_at is null
      where e.deleted_at is null and e.type <> 'board' and e.search @@ tq
        and (e.parent_id is null or exists (
              select 1 from milanote.elements c where c.id = e.parent_id and c.deleted_at is null))
      order by 10 desc, e.updated_at desc
      limit n);
end $$;

grant execute on function milanote.search(text, int) to authenticated;

commit;
