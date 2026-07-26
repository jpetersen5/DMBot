-- 005: remove dead weight

BEGIN;

DROP TRIGGER IF EXISTS update_charter_songs_trigger ON songs_deprecated;
DROP INDEX IF EXISTS idx_user_id;

CREATE OR REPLACE FUNCTION public.bulk_update_leaderboards(updates jsonb)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
    UPDATE songs_new s
    SET leaderboard = ARRAY(SELECT jsonb_array_elements(v.leaderboard)),
        last_update = v.last_update
    FROM jsonb_to_recordset(updates)
        AS v(md5 text, leaderboard jsonb, last_update timestamptz)
    WHERE s.md5 = v.md5;
$function$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLES FROM anon, authenticated;

COMMIT;
