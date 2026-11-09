-- 007: songs_new.fc_count / songs_new.total_plays
--
-- Original methods:
-- | proname             | pg_get_functiondef |
-- | ------------------- | ------------------ |
-- | get_song_list       | CREATE OR REPLACE FUNCTION public.get_song_list(since timestamp with time zone DEFAULT NULL::timestamp with time zone)
--                          RETURNS jsonb
--                          LANGUAGE sql
--                          STABLE
--                          SET search_path TO 'public', 'pg_temp'
--                          AS $function$
--                          SELECT jsonb_build_object(
--                            'server_time', now(),
--                            'songs', COALESCE((
--                              SELECT jsonb_agg(
--                                jsonb_build_object(
--                                  'id',             s.id,
--                                  'md5',            s.md5,
--                                'name',           s.name,
--                                'artist',         s.artist,
--                                'album',          s.album,
--                                'track',          s.track,
--                                'year',           s.year,
--                                'genre',          s.genre,
--                                'song_length',    s.song_length,
--                                'charter_refs',   s.charter_refs,
--                                'scores_count',   s.scores_count,
--                                'last_update',    s.last_update,
--                                'instruments',    s.instruments,
--                                'has_2x_kick',    s.has_2x_kick,
--                                'loading_phrase', s.loading_phrase,
--                                'playlist_path',  s.playlist_path,
--                                'chart_coverage', (
--                                  SELECT jsonb_object_agg(instr, diffs)
--                                  FROM (
--                                    SELECT nc->>'instrument' AS instr,
--                                          jsonb_agg(DISTINCT nc->>'difficulty') AS diffs
--                                    FROM unnest(s.note_counts) AS nc
--                                    GROUP BY 1
--                                  ) c
--                                )
--                              ) ORDER BY s.id)
--                            FROM public.songs_new s
--                            WHERE since IS NULL OR s.last_update >= since
--                          ), '[]'::jsonb),
--                          'deleted', COALESCE((
--                            SELECT jsonb_agg(jsonb_build_object('id', d.song_id, 'md5', d.md5))
--                            FROM public.deleted_songs d
--                            WHERE since IS NOT NULL AND d.deleted_at >= since
--                          ), '[]'::jsonb)
--                          );
--                          $function$
-- 
-- | update_scores_count | CREATE OR REPLACE FUNCTION public.update_scores_count()
--                          RETURNS trigger
--                          LANGUAGE plpgsql
--                          SET search_path TO 'public', 'pg_temp'
--                          AS $function$
--                          BEGIN
--                            NEW.scores_count = CASE
--                                WHEN NEW.leaderboard IS NULL THEN 0
--                                ELSE COALESCE(array_length(NEW.leaderboard, 1), 0)
--                            END;
--                            RETURN NEW;
--                          END;
--                          $function$

BEGIN;

ALTER TABLE public.songs_new
  ADD COLUMN IF NOT EXISTS fc_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_plays integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.songs_new.fc_count IS
  'Number of leaderboard entries with is_fc set. 0 means nobody has FC''d this song.';
COMMENT ON COLUMN public.songs_new.total_plays IS
  'Sum of play_count across all leaderboard entries. The real "most played" signal; scores_count is players-with-a-score.';

CREATE OR REPLACE FUNCTION public.update_scores_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF NEW.leaderboard IS NULL THEN
        NEW.scores_count := 0;
        NEW.fc_count     := 0;
        NEW.total_plays  := 0;
        RETURN NEW;
    END IF;

    SELECT COALESCE(array_length(NEW.leaderboard, 1), 0),
           COALESCE(count(*) FILTER (WHERE (e->>'is_fc')::boolean), 0)::int,
           COALESCE(sum(COALESCE((e->>'play_count')::int, 0)), 0)::int
      INTO NEW.scores_count, NEW.fc_count, NEW.total_plays
      FROM unnest(NEW.leaderboard) AS e;

    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.update_scores_count() IS
  'BEFORE INSERT/UPDATE OF leaderboard on songs_new: maintains scores_count, fc_count and total_plays.';

CREATE OR REPLACE FUNCTION public.get_song_list(since timestamptz DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT jsonb_build_object(
  'server_time', now(),
  'songs', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',             s.id,
        'md5',            s.md5,
        'name',           s.name,
        'artist',         s.artist,
        'album',          s.album,
        'track',          s.track,
        'year',           s.year,
        'genre',          s.genre,
        'song_length',    s.song_length,
        'charter_refs',   s.charter_refs,
        'scores_count',   s.scores_count,
        'fc_count',       s.fc_count,
        'total_plays',    s.total_plays,
        'last_update',    s.last_update,
        'instruments',    s.instruments,
        'has_2x_kick',    s.has_2x_kick,
        'loading_phrase', s.loading_phrase,
        'playlist_path',  s.playlist_path,
        'chart_coverage', (
          SELECT jsonb_object_agg(instr, diffs)
          FROM (
            SELECT nc->>'instrument' AS instr,
                   jsonb_agg(DISTINCT nc->>'difficulty') AS diffs
            FROM unnest(s.note_counts) AS nc
            GROUP BY 1
          ) c
        )
      ) ORDER BY s.id)
    FROM public.songs_new s
    WHERE since IS NULL OR s.last_update >= since
  ), '[]'::jsonb),
  'deleted', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', d.song_id, 'md5', d.md5))
    FROM public.deleted_songs d
    WHERE since IS NOT NULL AND d.deleted_at >= since
  ), '[]'::jsonb)
);
$function$;

COMMIT;

-- Verify:
--   SELECT count(*) FILTER (WHERE fc_count > 0) FROM songs_new;  -- 0
--   SELECT (get_song_list(NULL)->'songs'->0) ? 'total_plays';    -- true
