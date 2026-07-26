-- 006: move scores that reference deleted songs into unknown_scores

BEGIN;
SET LOCAL statement_timeout = '600s';

WITH orphan_moves AS (
  SELECT u.id AS user_id,
         e || jsonb_build_object(
                'rank', NULL,
                'charter_refs', coalesce(e->'charter_refs', '[]'::jsonb)
              ) AS entry,
         e->>'identifier' AS md5
  FROM users u, unnest(coalesce(u.scores, '{}'::jsonb[])) e
  WHERE NOT EXISTS (SELECT 1 FROM songs_new s WHERE s.md5 = e->>'identifier')
)
UPDATE users u
   SET scores = coalesce((
         SELECT array_agg(s.entry ORDER BY s.ord)
         FROM unnest(u.scores) WITH ORDINALITY AS s(entry, ord)
         WHERE EXISTS (SELECT 1 FROM songs_new sn WHERE sn.md5 = s.entry->>'identifier')
       ), '{}'::jsonb[]),
       unknown_scores = (
         SELECT array_agg(m.entry ORDER BY m.ord)
         FROM (
           SELECT CASE
                    WHEN i.entry IS NOT NULL
                     AND ( (i.entry->>'score')::bigint > (x.entry->>'score')::bigint
                        OR ( (i.entry->>'score')::bigint = (x.entry->>'score')::bigint
                         AND coalesce((i.entry->>'play_count')::int, 0)
                           > coalesce((x.entry->>'play_count')::int, 0) ) )
                    THEN i.entry
                    ELSE x.entry
                  END AS entry,
                  x.ord
           FROM unnest(coalesce(u.unknown_scores, '{}'::jsonb[])) WITH ORDINALITY AS x(entry, ord)
           LEFT JOIN orphan_moves i
                  ON i.user_id = u.id
                 AND i.md5 = x.entry->>'identifier'

           UNION ALL

           SELECT i.entry, 1000000 + row_number() OVER (ORDER BY i.md5)
           FROM orphan_moves i
           WHERE i.user_id = u.id
             AND NOT EXISTS (
               SELECT 1 FROM unnest(coalesce(u.unknown_scores, '{}'::jsonb[])) y
               WHERE y->>'identifier' = i.md5
             )
         ) m
       )
 WHERE EXISTS (SELECT 1 FROM orphan_moves om WHERE om.user_id = u.id);

COMMIT;

--   SELECT update_elo_rankings();

-- Verification
-- SELECT
--  (SELECT count(*) FROM users u, unnest(coalesce(u.scores,'{}'::jsonb[])) e
--    WHERE NOT EXISTS (SELECT 1 FROM songs_new s WHERE s.md5 = e->>'identifier')) AS orphans_remaining,
--  (SELECT count(*) FROM (
--     SELECT u.id, e->>'identifier' m FROM users u,
--       unnest(coalesce(u.scores,'{}'::jsonb[]) || coalesce(u.unknown_scores,'{}'::jsonb[])) e
--     GROUP BY 1,2 HAVING count(*)>1) x) AS cross_array_dupes_remaining;
