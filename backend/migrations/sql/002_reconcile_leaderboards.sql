-- Divergence measured 2026-07-25:
--     3079  (user, song) pairs in users.scores without leaderboard entry
--     2191  pairs present on both sides with a different score/percent/is_fc/play_count
--       66  pairs on a leaderboard with no corresponding users.scores entry
--       21  pairs where the leaderboard holds > score than users.scores
--       39  users affected

BEGIN;
SET LOCAL statement_timeout = '600s';


-- pull leaderboard results back into users.scores
CREATE TEMP TABLE lb_wins ON COMMIT DROP AS
WITH us AS (
  SELECT u.id::text AS user_id, s.score->>'identifier' AS md5,
         (s.score->>'score')::bigint AS score,
         coalesce((s.score->>'play_count')::int, 0) AS play_count
  FROM users u, unnest(u.scores) AS s(score)
  WHERE u.scores IS NOT NULL
),
lb AS (
  SELECT sn.md5, e->>'user_id' AS user_id, e AS entry
  FROM songs_new sn, unnest(sn.leaderboard) AS e
  WHERE sn.leaderboard IS NOT NULL
)
SELECT lb.md5, lb.user_id, lb.entry, (us.md5 IS NULL) AS is_new
FROM lb
LEFT JOIN us ON us.user_id = lb.user_id AND us.md5 = lb.md5
WHERE us.md5 IS NULL
   OR (lb.entry->>'score')::bigint > us.score
   OR ((lb.entry->>'score')::bigint = us.score
       AND coalesce((lb.entry->>'play_count')::int, 0) > us.play_count);

CREATE UNIQUE INDEX ON lb_wins (user_id, md5);
ANALYZE lb_wins;

WITH affected AS (
  SELECT DISTINCT user_id FROM lb_wins
),
patched AS (
  SELECT u.id,
         array_agg(
           CASE WHEN w.md5 IS NOT NULL
                THEN s.score || jsonb_build_object(
                       'score',      w.entry->'score',
                       'percent',    w.entry->'percent',
                       'is_fc',      w.entry->'is_fc',
                       'speed',      w.entry->'speed',
                       'play_count', w.entry->'play_count',
                       'posted',     w.entry->'posted')
                ELSE s.score
           END ORDER BY s.ord) AS scores
  FROM users u
  JOIN affected af ON af.user_id = u.id::text
  CROSS JOIN LATERAL unnest(u.scores) WITH ORDINALITY AS s(score, ord)
  LEFT JOIN lb_wins w ON w.user_id = u.id::text
                     AND w.md5 = s.score->>'identifier'
                     AND NOT w.is_new
  WHERE u.scores IS NOT NULL
  GROUP BY u.id
),
added AS (
  SELECT w.user_id,
         array_agg(jsonb_build_object(
           'identifier',   w.md5,
           'song_name',    sn.name,
           'artist',       sn.artist,
           'charter_refs', to_jsonb(coalesce(sn.charter_refs, ARRAY[]::text[])),
           'score',        w.entry->'score',
           'percent',      w.entry->'percent',
           'is_fc',        w.entry->'is_fc',
           'speed',        w.entry->'speed',
           'play_count',   w.entry->'play_count',
           'posted',       w.entry->'posted',
           'rank',         w.entry->'rank')) AS entries
  FROM lb_wins w
  JOIN songs_new sn ON sn.md5 = w.md5
  WHERE w.is_new
  GROUP BY w.user_id
),
final AS (
  SELECT af.user_id AS uid,
         coalesce(p.scores, ARRAY[]::jsonb[]) || coalesce(a.entries, ARRAY[]::jsonb[]) AS scores
  FROM affected af
  LEFT JOIN patched p ON p.id::text = af.user_id
  LEFT JOIN added   a ON a.user_id  = af.user_id
)
UPDATE users u
SET scores = f.scores
FROM final f
WHERE u.id::text = f.uid
  AND f.scores IS DISTINCT FROM u.scores;


-- rebuild the affected leaderboards from the reconciled users.scores
ALTER TABLE songs_new DISABLE TRIGGER update_user_scores_rank_trigger;

CREATE TEMP TABLE reconciled_leaderboards ON COMMIT DROP AS
WITH us AS (
  SELECT u.id::text AS user_id, u.username, s.score->>'identifier' AS md5, s.score AS entry
  FROM users u, unnest(u.scores) AS s(score)
  WHERE u.scores IS NOT NULL
),
lb AS (
  SELECT sn.md5, e->>'user_id' AS user_id, e AS entry
  FROM songs_new sn, unnest(sn.leaderboard) AS e
  WHERE sn.leaderboard IS NOT NULL
),
pair AS (
  SELECT coalesce(us.md5, lb.md5)         AS md5,
         coalesce(us.user_id, lb.user_id) AS user_id,
         us.username,
         us.entry AS u_entry,
         lb.entry AS l_entry
  FROM us
  FULL OUTER JOIN lb ON lb.md5 = us.md5 AND lb.user_id = us.user_id
  WHERE EXISTS (SELECT 1 FROM songs_new sn WHERE sn.md5 = coalesce(us.md5, lb.md5))
),
canon AS (
  SELECT md5, user_id,
    CASE
      WHEN u_entry IS NULL THEN l_entry

      WHEN l_entry IS NULL THEN jsonb_build_object(
             'user_id',    user_id,
             'username',   username,
             'score',      u_entry->'score',
             'percent',    u_entry->'percent',
             'is_fc',      u_entry->'is_fc',
             'speed',      u_entry->'speed',
             'play_count', u_entry->'play_count',
             'posted',     u_entry->'posted')

      WHEN (u_entry->>'score')::bigint > (l_entry->>'score')::bigint
        OR ((u_entry->>'score')::bigint = (l_entry->>'score')::bigint
            AND coalesce((u_entry->>'play_count')::int, 0)
              > coalesce((l_entry->>'play_count')::int, 0))
        THEN l_entry || jsonb_build_object(
             'score',      u_entry->'score',
             'percent',    u_entry->'percent',
             'is_fc',      u_entry->'is_fc',
             'speed',      u_entry->'speed',
             'play_count', u_entry->'play_count',
             'posted',     u_entry->'posted')

      ELSE l_entry
    END AS src
  FROM pair
),
ranked AS (
  SELECT md5,
         src || jsonb_build_object('rank', row_number() OVER (
           PARTITION BY md5
           ORDER BY (coalesce((src->>'speed')::numeric, 0) >= 100) DESC,
                    CASE WHEN coalesce((src->>'speed')::numeric, 0) >= 100
                         THEN coalesce((src->>'score')::numeric, 0)
                         ELSE coalesce((src->>'speed')::numeric, 0) END DESC,
                    CASE WHEN coalesce((src->>'speed')::numeric, 0) >= 100
                         THEN coalesce((src->>'speed')::numeric, 0)
                         ELSE coalesce((src->>'score')::numeric, 0) END DESC,
                    nullif(src->>'posted', '')::timestamptz ASC NULLS LAST
         )) AS entry
  FROM canon
)
SELECT md5, array_agg(entry ORDER BY (entry->>'rank')::int) AS leaderboard
FROM ranked
GROUP BY md5;

CREATE UNIQUE INDEX ON reconciled_leaderboards (md5);
ANALYZE reconciled_leaderboards;

UPDATE songs_new sn
SET leaderboard = r.leaderboard,
    last_update = now()
FROM reconciled_leaderboards r
WHERE r.md5 = sn.md5
  AND r.leaderboard IS DISTINCT FROM sn.leaderboard;


-- re-enable rank maintenance
ALTER TABLE songs_new ENABLE TRIGGER update_user_scores_rank_trigger;


-- resync every users.scores rank from the repaired leaderboards
WITH lbr AS (
  SELECT sn.md5, e->>'user_id' AS user_id, (e->>'rank')::int AS rank
  FROM songs_new sn, unnest(sn.leaderboard) AS e
  WHERE sn.leaderboard IS NOT NULL
),
rebuilt AS (
  SELECT u.id,
         array_agg(s.score || jsonb_build_object('rank', to_jsonb(lbr.rank))
                   ORDER BY s.ord) AS scores
  FROM users u
  CROSS JOIN LATERAL unnest(u.scores) WITH ORDINALITY AS s(score, ord)
  LEFT JOIN lbr ON lbr.md5 = s.score->>'identifier' AND lbr.user_id = u.id::text
  WHERE u.scores IS NOT NULL
  GROUP BY u.id
)
UPDATE users u
SET scores = rebuilt.scores
FROM rebuilt
WHERE rebuilt.id = u.id
  AND rebuilt.scores IS DISTINCT FROM u.scores;


-- recompute stats
SELECT update_all_user_stats();


-- Verification
WITH us AS (
  SELECT u.id::text AS user_id, s.score->>'identifier' AS md5,
         (s.score->>'score')::bigint AS score, s.score->>'rank' AS rank
  FROM users u, unnest(u.scores) AS s(score) WHERE u.scores IS NOT NULL
),
lb AS (
  SELECT sn.md5, e->>'user_id' AS user_id, (e->>'score')::bigint AS score,
         e->>'rank' AS rank
  FROM songs_new sn, unnest(sn.leaderboard) AS e WHERE sn.leaderboard IS NOT NULL
)
SELECT
  (SELECT count(*) FROM us
     WHERE EXISTS (SELECT 1 FROM songs_new sn WHERE sn.md5 = us.md5)
       AND NOT EXISTS (SELECT 1 FROM lb WHERE lb.md5 = us.md5 AND lb.user_id = us.user_id))
    AS still_missing_from_leaderboard,
  (SELECT count(*) FROM lb
     WHERE NOT EXISTS (SELECT 1 FROM us WHERE us.md5 = lb.md5 AND us.user_id = lb.user_id))
    AS still_missing_from_user_scores,
  (SELECT count(*) FROM us JOIN lb ON lb.md5 = us.md5 AND lb.user_id = us.user_id
     WHERE us.score IS DISTINCT FROM lb.score) AS score_still_diverged,
  (SELECT count(*) FROM us JOIN lb ON lb.md5 = us.md5 AND lb.user_id = us.user_id
     WHERE us.rank IS DISTINCT FROM lb.rank) AS rank_out_of_sync;

COMMIT;
