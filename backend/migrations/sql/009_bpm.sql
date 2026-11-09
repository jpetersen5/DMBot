-- 009: songs_new BPM columns

BEGIN;

ALTER TABLE public.songs_new
  ADD COLUMN IF NOT EXISTS bpm_dominant smallint,
  ADD COLUMN IF NOT EXISTS bpm_min      smallint,
  ADD COLUMN IF NOT EXISTS bpm_max      smallint;

COMMENT ON COLUMN public.songs_new.bpm_dominant IS
  'Duration-weighted dominant BPM. NULL until the chart has been re-scanned.';
COMMENT ON COLUMN public.songs_new.bpm_min IS
  'Lowest BPM in the tempo map.';
COMMENT ON COLUMN public.songs_new.bpm_max IS
  'Highest BPM in the tempo map.';

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
        'bpm_dominant',   s.bpm_dominant,
        'bpm_min',        s.bpm_min,
        'bpm_max',        s.bpm_max,
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

-- Verification:
  -- SELECT count(*) FILTER (WHERE bpm_dominant IS NOT NULL) AS with_bpm,
  --        count(*) FILTER (WHERE bpm_dominant IS NULL)     AS without_bpm,
  --        count(*) FILTER (WHERE bpm_min = bpm_max)        AS constant_bpm
  -- FROM songs_new; -- constant_bpm ~4,425
