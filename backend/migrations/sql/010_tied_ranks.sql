-- 010: tied leaderboard placements

BEGIN;

SET LOCAL statement_timeout = '600s';

WITH lb AS (
  SELECT sn.id, t.e AS entry, t.ord,
         (coalesce((t.e->>'speed')::numeric, 0) >= 100) AS fast
  FROM songs_new sn, unnest(sn.leaderboard) WITH ORDINALITY AS t(e, ord)
  WHERE sn.leaderboard IS NOT NULL
),
ranked AS (
  SELECT id, ord, entry,
         rank() OVER (
           PARTITION BY id
           ORDER BY fast DESC,
                    CASE WHEN fast THEN coalesce((entry->>'score')::numeric, 0)
                         ELSE coalesce((entry->>'speed')::numeric, 0) END DESC,
                    CASE WHEN fast THEN coalesce((entry->>'speed')::numeric, 0)
                         ELSE coalesce((entry->>'score')::numeric, 0) END DESC
         ) AS new_rank
  FROM lb
),
rebuilt AS (
  SELECT id,
         array_agg(entry || jsonb_build_object('rank', new_rank) ORDER BY new_rank, ord) AS leaderboard,
         bool_or((entry->>'rank')::int IS DISTINCT FROM new_rank) AS changed
  FROM ranked
  GROUP BY id
)
UPDATE songs_new sn
SET leaderboard = r.leaderboard
FROM rebuilt r
WHERE r.id = sn.id
  AND r.changed;

COMMIT;

-- Verification:
--
-- Record before applying; must be unchanged after:
--   SELECT max(last_update) FROM songs_new;
--
-- Boards match the tie rule (expect 0):
-- WITH lb AS (
--   SELECT sn.id, (e->>'rank')::int AS stored,
--          (coalesce((e->>'speed')::numeric, 0) >= 100) AS fast,
--          coalesce((e->>'score')::numeric, 0) AS score,
--          coalesce((e->>'speed')::numeric, 0) AS speed
--   FROM songs_new sn, unnest(sn.leaderboard) AS e
-- )
-- SELECT count(*) FROM (
--   SELECT stored, rank() OVER (PARTITION BY id ORDER BY fast DESC,
--            CASE WHEN fast THEN score ELSE speed END DESC,
--            CASE WHEN fast THEN speed ELSE score END DESC) AS want
--   FROM lb
-- ) x WHERE stored IS DISTINCT FROM want;
--
-- users.scores followed the boards (expect 0):
-- WITH us AS (SELECT u.id::text AS uid, s.score->>'identifier' AS md5, s.score->>'rank' AS rnk
--             FROM users u, unnest(u.scores) AS s(score) WHERE u.scores IS NOT NULL),
--      lb AS (SELECT sn.md5, e->>'user_id' AS uid, e->>'rank' AS rnk
--             FROM songs_new sn, unnest(sn.leaderboard) AS e)
-- SELECT count(*) FROM us JOIN lb USING (md5, uid) WHERE us.rnk IS DISTINCT FROM lb.rnk;
