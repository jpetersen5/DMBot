-- 007b: backfill of songs_new.fc_count / total_plays

BEGIN;

SET LOCAL statement_timeout = '600s';

DO $$
DECLARE
    last_id  bigint := 0;
    batch    bigint[];
    updated  int;
    total    int := 0;
BEGIN
    LOOP
        SELECT array_agg(id) INTO batch
        FROM (
            SELECT id FROM songs_new WHERE id > last_id ORDER BY id LIMIT 1000
        ) b;

        EXIT WHEN batch IS NULL;

        last_id := batch[array_length(batch, 1)];

        WITH agg AS (
            SELECT s.id,
                   COALESCE(count(e) FILTER (WHERE (e->>'is_fc')::boolean), 0)::int AS fc,
                   COALESCE(sum(COALESCE((e->>'play_count')::int, 0)), 0)::int      AS plays
            FROM songs_new s
            LEFT JOIN LATERAL unnest(s.leaderboard) AS e ON true
            WHERE s.id = ANY(batch)
            GROUP BY s.id
        )
        UPDATE songs_new s
        SET fc_count    = agg.fc,
            total_plays = agg.plays
        FROM agg
        WHERE s.id = agg.id
          AND (s.fc_count, s.total_plays) IS DISTINCT FROM (agg.fc, agg.plays);

        GET DIAGNOSTICS updated = ROW_COUNT;
        total := total + updated;
    END LOOP;

    RAISE NOTICE 'backfilled % songs', total;
END;
$$;

COMMIT;

-- Verification:
--
--   nobody_fcd  ~9.9k
--   has_an_fc   ~6.8k
--   plays      ~348k
--
-- SELECT count(*) FILTER (WHERE fc_count = 0 AND scores_count > 0) AS nobody_fcd,
--        count(*) FILTER (WHERE fc_count > 0)                      AS has_an_fc,
--        sum(total_plays)                                          AS plays
-- FROM songs_new;
--
-- Cross-check (expect 0):
-- SELECT s.id
-- FROM songs_new s
-- LEFT JOIN LATERAL unnest(s.leaderboard) AS e ON true
-- GROUP BY s.id, s.fc_count, s.total_plays
-- HAVING s.fc_count <> COALESCE(count(e) FILTER (WHERE (e->>'is_fc')::boolean), 0)
--     OR s.total_plays <> COALESCE(sum(COALESCE((e->>'play_count')::int, 0)), 0);
