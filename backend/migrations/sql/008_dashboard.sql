-- 008: user dashboard

BEGIN;

SET LOCAL statement_timeout = '600s';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dashboard_seen_at timestamptz;

COMMENT ON COLUMN public.users.dashboard_seen_at IS
  'When the user last acknowledged their dashboard feed. Distinct from last_login, which is unusable as a watermark.';

CREATE OR REPLACE FUNCTION public.get_user_overtakes(
  p_user_id text,
  p_since   timestamptz
)
RETURNS TABLE (
  song_id         bigint,
  md5             text,
  name            text,
  artist          text,
  my_place        int,
  my_score        int,
  my_posted       timestamptz,
  new_overtakes   int,
  total_overtakes int,
  latest_overtake timestamptz,
  top_score       int,
  top_username    text
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH mine AS (
    SELECT s.id, s.md5, s.name, s.artist, s.leaderboard,
           (e->>'rank')::int                    AS my_place,
           (e->>'score')::int                   AS my_score,
           nullif(e->>'posted','')::timestamptz AS my_posted
    FROM public.songs_new s, unnest(s.leaderboard) AS e
    WHERE e->>'user_id' = p_user_id
  ),
  ov AS (
    SELECT m.id, m.md5, m.name, m.artist, m.my_place, m.my_score, m.my_posted,
           count(*) FILTER (
             WHERE nullif(o->>'posted','')::timestamptz > p_since
           )::int                                                    AS new_overtakes,
           count(*)::int                                             AS total_overtakes,
           max(nullif(o->>'posted','')::timestamptz)                 AS latest_overtake,
           max((o->>'score')::int)                                   AS top_score,
           (array_agg(o->>'username' ORDER BY (o->>'rank')::int))[1] AS top_username
    FROM mine m, unnest(m.leaderboard) AS o
    WHERE (o->>'rank')::int < m.my_place
      AND nullif(o->>'posted','')::timestamptz > m.my_posted
    GROUP BY m.id, m.md5, m.name, m.artist, m.my_place, m.my_score, m.my_posted
  )
  SELECT id, md5, name, artist, my_place, my_score, my_posted,
         new_overtakes, total_overtakes, latest_overtake, top_score, top_username
  FROM ov
  WHERE new_overtakes > 0
  ORDER BY latest_overtake DESC;
$function$;

COMMENT ON FUNCTION public.get_user_overtakes(text, timestamptz) IS
  'Songs where a higher-placed player posted after p_user_id did, with p_since splitting new from total. Derived from leaderboard[].posted; no rank history is stored.';

COMMIT;

-- Verification:
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM get_user_overtakes('186331412641742850', now() - interval '30 days'); -- expect ~492 rows
--
-- Confirm seen_at:
--   SELECT scores_updated_at FROM users WHERE id = 186331412641742850;
--   UPDATE users SET dashboard_seen_at = now() WHERE id = 186331412641742850;
--   SELECT scores_updated_at FROM users WHERE id = 186331412641742850;  -- unchanged
