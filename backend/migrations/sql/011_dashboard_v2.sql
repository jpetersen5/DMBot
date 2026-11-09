-- 011: board size on user scores, dashboard overtakes v2

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_scores(p_user_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'scores', COALESCE((
      SELECT jsonb_agg(s.score || jsonb_build_object('board_size', COALESCE(sn.scores_count, 0))
                       ORDER BY s.ord)
      FROM unnest(u.scores) WITH ORDINALITY AS s(score, ord)
      LEFT JOIN public.songs_new sn ON sn.md5 = s.score->>'identifier'
    ), '[]'::jsonb),
    'unknown_scores', COALESCE(to_jsonb(u.unknown_scores), '[]'::jsonb)
  )
  FROM public.users u
  WHERE u.id::text = p_user_id;
$function$;

COMMENT ON FUNCTION public.get_user_scores(text) IS
  'users.scores with board_size (songs_new.scores_count) on each entry. NULL when the user does not exist.';

DROP FUNCTION IF EXISTS public.get_user_overtakes(text, timestamptz);

CREATE FUNCTION public.get_user_overtakes(
  p_user_id text,
  p_since   timestamptz
)
RETURNS TABLE (
  song_id         bigint,
  md5             text,
  name            text,
  artist          text,
  board_size      int,
  my_place        int,
  my_score        int,
  my_posted       timestamptz,
  new_overtakes   int,
  total_overtakes int,
  latest_overtake timestamptz,
  top_score       int,
  top_username    text,
  next_score      int,
  next_username   text,
  gap_to_next     int
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH mine AS (
    SELECT s.id, s.md5, s.name, s.artist, s.leaderboard,
           COALESCE(array_length(s.leaderboard, 1), 0) AS board_size,
           (e->>'rank')::int                     AS my_place,
           (e->>'score')::int                    AS my_score,
           nullif(e->>'posted', '')::timestamptz AS my_posted
    FROM public.songs_new s, unnest(s.leaderboard) AS e
    WHERE e->>'user_id' = p_user_id
  )
  SELECT m.id, m.md5, m.name, m.artist, m.board_size, m.my_place, m.my_score, m.my_posted,
         ov.new_overtakes, ov.total_overtakes, ov.latest_overtake,
         top.score, top.username,
         nxt.score, nxt.username,
         greatest(nxt.score - m.my_score, 0)
  FROM mine m
  CROSS JOIN LATERAL (
    SELECT count(*) FILTER (
             WHERE nullif(o->>'posted', '')::timestamptz > p_since
           )::int                                         AS new_overtakes,
           count(*)::int                                  AS total_overtakes,
           max(nullif(o->>'posted', '')::timestamptz)     AS latest_overtake
    FROM unnest(m.leaderboard) AS o
    WHERE (o->>'rank')::int < m.my_place
      AND nullif(o->>'posted', '')::timestamptz > m.my_posted
  ) ov
  LEFT JOIN LATERAL (
    SELECT (o->>'score')::int AS score, o->>'username' AS username
    FROM unnest(m.leaderboard) AS o
    WHERE (o->>'rank')::int = 1
    ORDER BY (o->>'score')::int DESC
    LIMIT 1
  ) top ON true
  LEFT JOIN LATERAL (
    SELECT (o->>'score')::int AS score, o->>'username' AS username
    FROM unnest(m.leaderboard) AS o
    WHERE (o->>'rank')::int < m.my_place
    ORDER BY (o->>'rank')::int DESC
    LIMIT 1
  ) nxt ON true
  WHERE ov.new_overtakes > 0
  ORDER BY ov.latest_overtake DESC;
$function$;

COMMENT ON FUNCTION public.get_user_overtakes(text, timestamptz) IS
  'Songs where a higher-placed player posted after p_user_id did, with the board leader and the next place up. Derived from leaderboard[].posted; no rank history is stored.';

REVOKE EXECUTE ON FUNCTION public.get_user_scores(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_overtakes(text, timestamptz) FROM PUBLIC, anon, authenticated;

COMMIT;

-- Verification:
--   SELECT get_user_scores('186331412641742850') -> 'scores' -> 0;   -- has board_size
--   SELECT get_user_scores('nope');                                  -- NULL
--   SELECT has_function_privilege('anon', 'get_user_scores(text)', 'EXECUTE');  -- false
--
--   SELECT count(*) FILTER (WHERE gap_to_next IS NULL) = count(*) FILTER (WHERE my_place = 1)
--   FROM get_user_overtakes('186331412641742850', now() - interval '30 days');  -- true
--
--   -- one row per song even where 1st place is tied (expect 0)
--   SELECT count(*) - count(DISTINCT song_id)
--   FROM get_user_overtakes('186331412641742850', '-infinity');
