BEGIN;

DROP TRIGGER IF EXISTS update_user_scores_rank_trigger ON songs_new;

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
    SELECT n.md5, n.leaderboard
    FROM changed n
    JOIN old_rows o ON o.id = n.id
    WHERE n.leaderboard IS DISTINCT FROM o.leaderboard
  ),
  new_ranks AS (
    SELECT cs.md5,
           entry->>'user_id'     AS user_id,
           (entry->>'rank')::int AS rank
    FROM changed_songs cs, LATERAL unnest(cs.leaderboard) AS entry
  )
  UPDATE users u
  SET scores = (
    SELECT array_agg(
             CASE WHEN cs.md5 IS NOT NULL
                  THEN s.score || jsonb_build_object('rank', nr.rank)
                  ELSE s.score
             END
             ORDER BY s.ord)
    FROM unnest(u.scores) WITH ORDINALITY AS s(score, ord)
    LEFT JOIN changed_songs cs ON cs.md5 = s.score->>'identifier'
    LEFT JOIN new_ranks     nr ON nr.md5 = s.score->>'identifier'
                              AND nr.user_id = u.id::text
  )
  WHERE u.scores IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(u.scores) AS score
      JOIN changed_songs cs ON cs.md5 = score->>'identifier'
    );

  RETURN NULL;
END;
$function$;

CREATE TRIGGER update_user_scores_rank_trigger
  AFTER UPDATE ON songs_new
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS changed
  FOR EACH STATEMENT
  EXECUTE FUNCTION update_user_scores_rank();


DROP TRIGGER IF EXISTS update_charter_songs_trigger_new ON songs_new;

CREATE TRIGGER update_charter_songs_trigger_new
  AFTER INSERT OR DELETE OR UPDATE OF charter_refs ON songs_new
  FOR EACH ROW EXECUTE FUNCTION update_charter_songs();


DROP TRIGGER IF EXISTS scores_count_trigger ON songs_new;

CREATE TRIGGER scores_count_trigger
  BEFORE INSERT OR UPDATE OF leaderboard ON songs_new
  FOR EACH ROW EXECUTE FUNCTION update_scores_count();

COMMIT;


-- Verification
BEGIN;
EXPLAIN (ANALYZE, BUFFERS)
  UPDATE songs_new s
  SET leaderboard = ARRAY(SELECT jsonb_array_elements(v.leaderboard)),
      last_update = v.last_update
  FROM jsonb_to_recordset(
         (SELECT jsonb_agg(jsonb_build_object(
             'md5', md5, 'leaderboard', to_jsonb(leaderboard), 'last_update', now()))
           FROM (SELECT md5, leaderboard FROM songs_new
                 WHERE leaderboard IS NOT NULL LIMIT 100) t)
        ) AS v(md5 text, leaderboard jsonb, last_update timestamptz)
  WHERE s.md5 = v.md5;
ROLLBACK;

BEGIN;
EXPLAIN (ANALYZE) UPDATE songs_new SET image_url = image_url
WHERE id IN (SELECT id FROM songs_new LIMIT 100);
ROLLBACK;
