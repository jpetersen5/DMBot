-- 013: rank-copy trigger rewrites only players whose rank moved

BEGIN;

CREATE OR REPLACE FUNCTION public.update_user_scores_rank()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n_changed int;
BEGIN
  SELECT count(*) INTO n_changed
  FROM changed n
  JOIN old_rows o ON o.id = n.id
  WHERE n.leaderboard IS DISTINCT FROM o.leaderboard;

  IF n_changed = 0 THEN
    RETURN NULL;
  END IF;

  WITH changed_songs AS (
    SELECT n.md5, n.leaderboard AS new_lb, o.leaderboard AS old_lb
    FROM changed n
    JOIN old_rows o ON o.id = n.id
    WHERE n.leaderboard IS DISTINCT FROM o.leaderboard
  ),
  new_ranks AS (
    SELECT cs.md5, e->>'user_id' AS user_id, (e->>'rank')::int AS rank
    FROM changed_songs cs, unnest(cs.new_lb) AS e
  ),
  old_ranks AS (
    SELECT cs.md5, e->>'user_id' AS user_id, (e->>'rank')::int AS rank
    FROM changed_songs cs, unnest(cs.old_lb) AS e
  ),
  moved AS (
    SELECT coalesce(nr.md5, orr.md5)         AS md5,
           coalesce(nr.user_id, orr.user_id) AS user_id,
           nr.rank
    FROM new_ranks nr
    FULL JOIN old_ranks orr ON orr.md5 = nr.md5 AND orr.user_id = nr.user_id
    WHERE nr.user_id IS NULL
       OR orr.user_id IS NULL
       OR nr.rank IS DISTINCT FROM orr.rank
  ),
  per_user AS (
    SELECT user_id::bigint AS user_id, jsonb_object_agg(md5, rank) AS ranks
    FROM moved
    WHERE user_id ~ '^[0-9]+$'
    GROUP BY user_id
  )
  UPDATE users u
  SET scores = (
    SELECT array_agg(
             CASE WHEN pu.ranks ? (s.score->>'identifier')
                  THEN s.score || jsonb_build_object('rank', pu.ranks->(s.score->>'identifier'))
                  ELSE s.score
             END
             ORDER BY s.ord)
    FROM unnest(u.scores) WITH ORDINALITY AS s(score, ord)
  )
  FROM per_user pu
  WHERE u.id = pu.user_id
    AND EXISTS (
      SELECT 1 FROM unnest(u.scores) AS x
      WHERE pu.ranks ? (x->>'identifier')
    );

  RETURN NULL;
END;
$function$;

COMMIT;

-- Verification:
--
-- New body is live (expect true):
--   SELECT pg_get_functiondef('public.update_user_scores_rank'::regproc) LIKE '%per_user%';
--
-- users.scores followed the boards (expect 0):
-- WITH us AS (SELECT u.id::text AS uid, s.score->>'identifier' AS md5, s.score->>'rank' AS rnk
--             FROM users u, unnest(u.scores) AS s(score) WHERE u.scores IS NOT NULL),
--      lb AS (SELECT sn.md5, e->>'user_id' AS uid, e->>'rank' AS rnk
--             FROM songs_new sn, unnest(sn.leaderboard) AS e)
-- SELECT count(*) FROM us JOIN lb USING (md5, uid) WHERE us.rnk IS DISTINCT FROM lb.rnk;
--
-- Off-board scores carry no rank (expect 0, before and after; this trigger no longer
-- re-syncs players whose rank didn't move, so drift would persist):
-- WITH lb AS (SELECT sn.md5, e->>'user_id' AS uid FROM songs_new sn, unnest(sn.leaderboard) AS e)
-- SELECT count(*) FROM users u, unnest(u.scores) AS s
-- WHERE s->>'rank' IS NOT NULL
--   AND EXISTS (SELECT 1 FROM songs_new sn WHERE sn.md5 = s->>'identifier')
--   AND NOT EXISTS (SELECT 1 FROM lb WHERE lb.md5 = s->>'identifier' AND lb.uid = u.id::text);
--
-- Cost of a rank-neutral rewrite of 100 boards; compare the trigger time before and after:
-- BEGIN;
-- EXPLAIN (ANALYZE, BUFFERS)
--   UPDATE songs_new s
--   SET leaderboard = ARRAY(SELECT e || '{"stars": 0}'::jsonb FROM unnest(s.leaderboard) AS e)
--   WHERE s.id IN (SELECT id FROM songs_new WHERE cardinality(leaderboard) > 0
--                  ORDER BY cardinality(leaderboard) DESC LIMIT 100);
-- ROLLBACK;
