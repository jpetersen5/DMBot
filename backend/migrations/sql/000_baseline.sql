-- REFERENCE ONLY -- DO NOT RUN
--
-- Indexes on songs_new
-- CREATE UNIQUE INDEX songs_new_pkey            ON public.songs_new USING btree (id);
-- CREATE UNIQUE INDEX songs_new_md5_key         ON public.songs_new USING btree (md5);
-- CREATE INDEX        songs_new_artist_idx      ON public.songs_new USING btree (artist);
-- CREATE INDEX        songs_new_genre_idx       ON public.songs_new USING btree (genre);
-- CREATE INDEX        songs_new_album_idx       ON public.songs_new USING btree (album);
-- CREATE INDEX        songs_new_last_update_idx ON public.songs_new USING btree (last_update);
-- CREATE INDEX        songs_new_charter_refs_gin ON public.songs_new USING gin (charter_refs);


-- bulk_update_leaderboards
CREATE OR REPLACE FUNCTION public.bulk_update_leaderboards(updates jsonb)
RETURNS void
LANGUAGE sql
AS $function$
    UPDATE songs_new s
    SET leaderboard = ARRAY(SELECT jsonb_array_elements(v.leaderboard)),
        last_update = v.last_update
    FROM jsonb_to_recordset(updates)
        AS v(md5 text, leaderboard jsonb, last_update timestamptz)
    WHERE s.md5 = v.md5;
$function$;


-- update_scores_count
CREATE OR REPLACE FUNCTION public.update_scores_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.scores_count = CASE
        WHEN NEW.leaderboard IS NULL THEN 0
        ELSE COALESCE(array_length(NEW.leaderboard, 1), 0)
    END;
    RETURN NEW;
END;
$function$;


-- update_charter_songs
CREATE OR REPLACE FUNCTION public.update_charter_songs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    affected_charters TEXT[];
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_charters := OLD.charter_refs;
    ELSIF TG_OP = 'UPDATE' THEN
        affected_charters := array_cat(OLD.charter_refs, NEW.charter_refs);
    ELSE -- INSERT
        affected_charters := NEW.charter_refs;
    END IF;

    UPDATE charters c
    SET charter_songs = (
        SELECT array_agg(s.id)
        FROM songs_new s
        WHERE s.charter_refs @> ARRAY[c.name]
    )
    WHERE c.name = ANY(affected_charters);

    RETURN NULL;
END;
$function$;


-- update_user_scores_rank
CREATE OR REPLACE FUNCTION public.update_user_scores_rank()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE users
  SET scores = (
    SELECT array_agg(
      CASE
        WHEN score->>'identifier' = NEW.md5 THEN
          score || jsonb_build_object(
            'rank', (
              SELECT (entry->>'rank')::int
              FROM unnest(NEW.leaderboard) AS entry
              WHERE entry->>'user_id' = users.id::text
              LIMIT 1
            )
          )
        ELSE score
      END
    )
    FROM unnest(users.scores) AS score
  )
  WHERE scores IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM unnest(users.scores) AS score
      WHERE score->>'identifier' = NEW.md5
    );

  RETURN NEW;
END;
$function$;


-- update_all_user_stats
CREATE OR REPLACE FUNCTION public.update_all_user_stats()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
    WITH ranked_users AS (
        SELECT id, RANK() OVER (ORDER BY elo DESC) as rank
        FROM users
        WHERE elo IS NOT NULL
    )
    UPDATE users
    SET stats = subquery.new_stats
    FROM (
        SELECT
            users.id,
            jsonb_build_object(
                'total_scores', COALESCE(scores_stats.total_scores, 0) + COALESCE(unknown_scores_stats.total_scores, 0),
                'total_fcs', COALESCE(scores_stats.total_fcs, 0) + COALESCE(unknown_scores_stats.total_fcs, 0),
                'total_score', COALESCE(scores_stats.total_score, 0) + COALESCE(unknown_scores_stats.total_score, 0),
                'avg_percent',
                    CASE
                        WHEN COALESCE(scores_stats.total_scores, 0) + COALESCE(unknown_scores_stats.total_scores, 0) > 0
                        THEN (COALESCE(scores_stats.total_percent, 0) + COALESCE(unknown_scores_stats.total_percent, 0)) /
                             (COALESCE(scores_stats.total_scores, 0) + COALESCE(unknown_scores_stats.total_scores, 0))
                        ELSE 0
                    END,
                'rank', ranked_users.rank
            ) AS new_stats
        FROM
            users
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*) AS total_scores,
                SUM(CASE WHEN (score->>'is_fc')::boolean THEN 1 ELSE 0 END) AS total_fcs,
                SUM((score->>'score')::bigint) AS total_score,
                SUM((score->>'percent')::float) AS total_percent
            FROM
                unnest(users.scores) AS score
        ) AS scores_stats ON true
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*) AS total_scores,
                SUM(CASE WHEN (score->>'is_fc')::boolean THEN 1 ELSE 0 END) AS total_fcs,
                SUM((score->>'score')::bigint) AS total_score,
                SUM((score->>'percent')::float) AS total_percent
            FROM
                unnest(users.unknown_scores) AS score
        ) AS unknown_scores_stats ON true
        LEFT JOIN ranked_users ON ranked_users.id = users.id
    ) AS subquery
    WHERE users.id = subquery.id;
END;
$function$;


-- Triggers on songs_new
-- CREATE TRIGGER scores_count_trigger
--   BEFORE INSERT OR UPDATE ON public.songs_new
--   FOR EACH ROW EXECUTE FUNCTION update_scores_count();
--
-- CREATE TRIGGER update_charter_songs_trigger_new
--   AFTER INSERT OR DELETE OR UPDATE ON public.songs_new
--   FOR EACH ROW EXECUTE FUNCTION update_charter_songs();
--
-- CREATE TRIGGER update_user_scores_rank_trigger
--   AFTER UPDATE OF leaderboard ON public.songs_new
--   FOR EACH ROW EXECUTE FUNCTION update_user_scores_rank();
