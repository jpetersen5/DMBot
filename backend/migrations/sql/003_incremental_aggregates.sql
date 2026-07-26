-- 003: make the hourly cron aggregates incremental.
--
-- Measured before:
--   update_all_charter_stats()  8.97h total / 27.2s mean / 64.4% of DB usage
--   update_elo_rankings()       3.47h total / 10.9s mean / 24.9% of DB usage
--
-- Measured after:
--   update_elo_rankings          10,881ms -> 3ms idle / 254ms churn / 2,197ms cold
--   charter stats (both halves)  27,200ms -> 48ms idle / 419ms cold full rebuild

BEGIN;
SET LOCAL statement_timeout = '600s';

CREATE TABLE IF NOT EXISTS job_watermarks (
  job_name text PRIMARY KEY,
  ran_at   timestamptz NOT NULL DEFAULT '-infinity'::timestamptz
);

INSERT INTO job_watermarks (job_name) VALUES
  ('elo_rankings'), ('charter_scores_rollup'), ('charter_distributions')
ON CONFLICT (job_name) DO NOTHING;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS scores_updated_at timestamptz NOT NULL
  DEFAULT '-infinity'::timestamptz;

UPDATE users SET scores_updated_at = now();

CREATE OR REPLACE FUNCTION public.update_user_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    total_scores INTEGER := 0;
    total_fcs INTEGER := 0;
    total_score BIGINT := 0;
    total_percent FLOAT := 0;
    avg_percent FLOAT := 0;
    user_rank INTEGER;
BEGIN
    IF NEW.scores IS NOT NULL THEN
        SELECT COUNT(*),
               SUM(CASE WHEN (score->>'is_fc')::boolean THEN 1 ELSE 0 END),
               SUM((score->>'score')::bigint),
               SUM((score->>'percent')::float)
          INTO total_scores, total_fcs, total_score, total_percent
          FROM unnest(NEW.scores) AS score;
    END IF;

    IF NEW.unknown_scores IS NOT NULL THEN
        SELECT total_scores + COUNT(*),
               total_fcs + SUM(CASE WHEN (score->>'is_fc')::boolean THEN 1 ELSE 0 END),
               total_score + SUM((score->>'score')::bigint),
               total_percent + SUM((score->>'percent')::float)
          INTO total_scores, total_fcs, total_score, total_percent
          FROM unnest(NEW.unknown_scores) AS score;
    END IF;

    avg_percent := CASE WHEN total_scores > 0 THEN total_percent / total_scores ELSE 0 END;

    SELECT rank INTO user_rank
    FROM (
        SELECT id, RANK() OVER (ORDER BY elo DESC NULLS LAST) as rank
        FROM users
        WHERE elo IS NOT NULL
    ) ranked_users
    WHERE id = NEW.id;

    NEW.stats := jsonb_build_object(
        'total_scores', total_scores,
        'total_fcs',    total_fcs,
        'total_score',  total_score,
        'avg_percent',  avg_percent,
        'rank',         CASE WHEN NEW.elo IS NOT NULL THEN user_rank ELSE NULL END
    );

    NEW.scores_updated_at := now();

    RETURN NEW;
END;
$function$;

CREATE TABLE IF NOT EXISTS user_score_index (
  user_id bigint NOT NULL,
  md5     text   NOT NULL,
  score   integer NOT NULL
);

DROP INDEX IF EXISTS user_score_index_md5_idx;
CREATE INDEX IF NOT EXISTS user_score_index_user_idx ON user_score_index (user_id);

CREATE OR REPLACE FUNCTION public.refresh_user_score_index(since timestamptz)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET work_mem TO '32MB'
AS $function$
DECLARE
  content_changed boolean;
BEGIN
  DROP TABLE IF EXISTS incoming;
  DROP TABLE IF EXISTS dirty_users;

  CREATE TEMPORARY TABLE incoming ON COMMIT DROP AS
  SELECT u.id AS user_id,
         e->>'identifier'   AS md5,
         (e->>'score')::int AS score
  FROM users u,
       LATERAL unnest(coalesce(u.scores, '{}'::jsonb[]) ||
                      coalesce(u.unknown_scores, '{}'::jsonb[])) AS e
  WHERE u.scores_updated_at > since
    AND e->>'identifier' IS NOT NULL
    AND e->>'score' IS NOT NULL;

  CREATE TEMPORARY TABLE dirty_users ON COMMIT DROP AS
  SELECT DISTINCT user_id FROM incoming;

  IF NOT EXISTS (SELECT 1 FROM dirty_users) THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM (
      (SELECT user_id, md5, score FROM incoming
       EXCEPT ALL
       SELECT user_id, md5, score FROM user_score_index
        WHERE user_id IN (SELECT user_id FROM dirty_users))
      UNION ALL
      (SELECT user_id, md5, score FROM user_score_index
        WHERE user_id IN (SELECT user_id FROM dirty_users)
       EXCEPT ALL
       SELECT user_id, md5, score FROM incoming)
    ) d
  ) INTO content_changed;

  IF content_changed THEN
    DELETE FROM user_score_index
     WHERE user_id IN (SELECT user_id FROM dirty_users);
    INSERT INTO user_score_index (user_id, md5, score)
    SELECT user_id, md5, score FROM incoming;

    ANALYZE user_score_index;
  END IF;

  RETURN content_changed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_elo_rankings()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET work_mem TO '32MB'
AS $function$
DECLARE
    base_k_factor CONSTANT FLOAT := 32.0;
    default_elo   CONSTANT INTEGER := 1000;
    min_scores    CONSTANT INTEGER := 100;
    wm            timestamptz;
    started_at    timestamptz := now();
    did_change    boolean;
BEGIN
    SELECT ran_at INTO wm FROM job_watermarks WHERE job_name = 'elo_rankings';

    did_change := refresh_user_score_index(wm);

    IF NOT did_change THEN
        UPDATE job_watermarks SET ran_at = started_at WHERE job_name = 'elo_rankings';
        RETURN;
    END IF;

    DROP TABLE IF EXISTS prev_elo;
    DROP TABLE IF EXISTS cohort;
    DROP TABLE IF EXISTS user_comparisons;

    CREATE TEMPORARY TABLE prev_elo ON COMMIT DROP AS
    SELECT id, elo FROM users;

    UPDATE users
       SET elo = default_elo
     WHERE COALESCE(array_length(scores, 1), 0)
         + COALESCE(array_length(unknown_scores, 1), 0) >= min_scores;

    CREATE TEMPORARY TABLE cohort ON COMMIT DROP AS
    SELECT id FROM users
     WHERE elo IS NOT NULL
       AND COALESCE(array_length(scores, 1), 0)
         + COALESCE(array_length(unknown_scores, 1), 0) >= min_scores;

    CREATE TEMPORARY TABLE user_comparisons ON COMMIT DROP AS
    SELECT t.ua AS user1_id,
           t.ub AS user2_id,
           CASE WHEN t.w > t.cnt / 2.0 THEN 1
                WHEN t.w < t.cnt / 2.0 THEN 0
                ELSE 0.5 END AS result,
           t.cnt AS common_songs
    FROM (
      SELECT a.user_id AS ua, b.user_id AS ub,
             count(*) AS cnt,
             sum(CASE WHEN a.score > b.score THEN 1
                      WHEN a.score < b.score THEN 0
                      ELSE 0.5 END) AS w
      FROM user_score_index a
      JOIN user_score_index b
        ON b.md5 = a.md5
       AND a.user_id < b.user_id
      WHERE a.user_id IN (SELECT id FROM cohort)
        AND b.user_id IN (SELECT id FROM cohort)
      GROUP BY 1, 2
    ) t;

    WITH user_stats AS (
        SELECT user_id,
               SUM(CASE WHEN result = 1 THEN 1 ELSE 0 END) AS wins,
               SUM(CASE WHEN result = 0 THEN 1 ELSE 0 END) AS losses,
               COUNT(*) AS total_matches
        FROM (
            SELECT user1_id AS user_id, result FROM user_comparisons WHERE result IS NOT NULL
            UNION ALL
            SELECT user2_id AS user_id, 1 - result AS result FROM user_comparisons WHERE result IS NOT NULL
        ) all_results
        GROUP BY user_id
    ),
    elo_changes AS (
        SELECT user1_id AS user_id,
               SUM(
                   CASE
                       WHEN us1.total_matches > 0 THEN
                           base_k_factor * (1 + (us1.wins::float / us1.total_matches) - 0.5) *
                           (result - 1 / (1 + POWER(10, (opponent_elo - user_elo) / 400.0))) *
                           ((-EXP(-(common_songs::float / 50 + 1.1)) + 1.5) / 1.5)
                       ELSE
                           base_k_factor * (result - 1 / (1 + POWER(10, (opponent_elo - user_elo) / 400.0))) *
                           ((-EXP(-(common_songs::float / 50 + 1.1)) + 1.5) / 1.5)
                   END
               ) AS elo_change
        FROM (
            SELECT user1_id, user2_id AS opponent_id, result, common_songs,
                   u1.elo AS user_elo, u2.elo AS opponent_elo
            FROM user_comparisons
            JOIN users u1 ON user1_id = u1.id
            JOIN users u2 ON user2_id = u2.id
            WHERE result IS NOT NULL
            UNION ALL
            SELECT user2_id, user1_id AS opponent_id, 1 - result, common_songs,
                   u2.elo AS user_elo, u1.elo AS opponent_elo
            FROM user_comparisons
            JOIN users u1 ON user1_id = u1.id
            JOIN users u2 ON user2_id = u2.id
            WHERE result IS NOT NULL
        ) all_comparisons
        JOIN user_stats us1 ON user1_id = us1.user_id
        GROUP BY user1_id
    ),
    updated_users AS (
        UPDATE users u
           SET elo = GREATEST(u.elo + ec.elo_change, 1)
          FROM elo_changes ec
         WHERE u.id = ec.user_id
        RETURNING u.id, u.elo
    )
    INSERT INTO elo_history (user_id, elo)
    SELECT u.id, u.elo
      FROM updated_users u
      JOIN prev_elo p ON p.id = u.id
     WHERE u.elo IS DISTINCT FROM p.elo;

    UPDATE job_watermarks SET ran_at = started_at WHERE job_name = 'elo_rankings';
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_charter_scores_rollup()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  wm         timestamptz;
  started_at timestamptz := now();
BEGIN
  SELECT ran_at INTO wm FROM job_watermarks WHERE job_name = 'charter_scores_rollup';

  WITH pairs AS MATERIALIZED (
    SELECT ref.name AS charter_name, s.song_length, s.scores_count, s.last_update
    FROM songs_new s
    CROSS JOIN LATERAL unnest(s.charter_refs) AS ref(name)
  ),
  changed AS MATERIALIZED (
    SELECT DISTINCT charter_name FROM pairs WHERE last_update > wm
  ),
  agg AS (
    SELECT p.charter_name,
           count(*)            AS total_songs,
           sum(p.song_length)  AS total_length,
           avg(p.song_length)  AS avg_length,
           sum(p.scores_count) AS total_scores,
           avg(p.scores_count) AS avg_scores
    FROM pairs p
    JOIN changed ch ON ch.charter_name = p.charter_name
    GROUP BY 1
  )
  UPDATE charters c
     SET charter_stats = coalesce(c.charter_stats, '{}'::jsonb) || jsonb_build_object(
           'total_songs',  coalesce(a.total_songs, 0),
           'total_length', a.total_length,
           'avg_length',   a.avg_length,
           'total_scores', a.total_scores,
           'avg_scores',   a.avg_scores,
           'last_updated', CURRENT_TIMESTAMP
         )
    FROM changed ch
    LEFT JOIN agg a ON a.charter_name = ch.charter_name
   WHERE c.name = ch.charter_name;

  UPDATE job_watermarks SET ran_at = started_at WHERE job_name = 'charter_scores_rollup';
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_charter_distributions()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  wm         timestamptz;
  started_at timestamptz := now();
BEGIN
  SELECT ran_at INTO wm FROM job_watermarks WHERE job_name = 'charter_distributions';

  WITH all_pairs AS MATERIALIZED (
    SELECT ref.name AS charter_name, s.difficulties, s.genre, s.year, s.artist, s.last_update
    FROM songs_new s
    CROSS JOIN LATERAL unnest(s.charter_refs) AS ref(name)
  ),
  changed AS MATERIALIZED (
    SELECT DISTINCT charter_name FROM all_pairs WHERE last_update > wm
  ),
  pairs AS MATERIALIZED (
    SELECT p.charter_name, p.difficulties, p.genre, p.year, p.artist
    FROM all_pairs p
    JOIN changed ch ON ch.charter_name = p.charter_name
  ),
  diff_counts AS (
    SELECT p.charter_name, inst.name AS inst,
           (p.difficulties->>inst.name)::int AS difficulty, count(*) AS cnt
    FROM pairs p
    CROSS JOIN (VALUES ('drums'),('guitar'),('rhythm'),('bass'),('keys')) AS inst(name)
    WHERE p.difficulties ? inst.name
    GROUP BY p.charter_name, inst.name, (p.difficulties->>inst.name)::int
  ),
  diff_per_inst AS (
    SELECT charter_name, inst, jsonb_object_agg(difficulty, cnt) AS dist
    FROM diff_counts GROUP BY charter_name, inst
  ),
  diff_map AS (
    SELECT charter_name, jsonb_object_agg(inst, dist) AS m
    FROM diff_per_inst GROUP BY charter_name
  ),
  genre_map AS (
    SELECT charter_name, jsonb_object_agg(genre, cnt) AS dist
    FROM (
      SELECT charter_name, coalesce(genre, 'Unknown') AS genre, count(*) AS cnt
      FROM pairs GROUP BY charter_name, coalesce(genre, 'Unknown')
    ) g GROUP BY charter_name
  ),
  year_map AS (
    SELECT charter_name, jsonb_object_agg(yr, cnt) AS dist
    FROM (
      SELECT charter_name, coalesce(year::text, 'Unknown') AS yr, count(*) AS cnt
      FROM pairs GROUP BY charter_name, coalesce(year::text, 'Unknown')
    ) y GROUP BY charter_name
  ),
  top_artist AS (
    SELECT DISTINCT ON (charter_name) charter_name, artist
    FROM (
      SELECT charter_name, artist, count(*) AS cnt
      FROM pairs GROUP BY charter_name, artist
    ) a
    ORDER BY charter_name, cnt DESC, artist ASC
  )
  UPDATE charters c
     SET charter_stats = coalesce(c.charter_stats, '{}'::jsonb) || jsonb_build_object(
           'difficulty_distribution', jsonb_build_object(
             'drums',  dm.m->'drums',
             'guitar', dm.m->'guitar',
             'rhythm', dm.m->'rhythm',
             'bass',   dm.m->'bass',
             'keys',   dm.m->'keys'
           ),
           'genre_distribution', gm.dist,
           'year_distribution',  ym.dist,
           'most_common_artist', ta.artist
         )
    FROM changed ch
    LEFT JOIN diff_map   dm ON dm.charter_name = ch.charter_name
    LEFT JOIN genre_map  gm ON gm.charter_name = ch.charter_name
    LEFT JOIN year_map   ym ON ym.charter_name = ch.charter_name
    LEFT JOIN top_artist ta ON ta.charter_name = ch.charter_name
   WHERE c.name = ch.charter_name;

  UPDATE job_watermarks SET ran_at = started_at WHERE job_name = 'charter_distributions';
END;
$function$;

COMMIT;

-- SELECT cron.alter_job(2, schedule => '10 * * * *',
--   command => 'SELECT canonicalize_charter_refs(); SELECT update_all_charter_songs(); SELECT update_charter_scores_rollup();');
-- SELECT cron.alter_job(3, schedule => '30 * * * *');   -- update_elo_rankings
-- SELECT cron.alter_job(4, schedule => '40 * * * *');   -- update_all_user_stats
-- SELECT cron.schedule('daily-charter-distributions', '20 9 * * *',
--   'SELECT update_charter_distributions()');
