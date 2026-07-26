-- 004: users.stats
--
--   compute_user_stats_jsonb()  formula
--   update_user_stats() trigger writes the stored copy, rank carried forward
--   update_all_user_stats()     hourly, owns rank
--   compute_user_stats() (py)   in-memory for achievement tracking

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_user_stats_jsonb(
  p_scores jsonb[], p_unknown_scores jsonb[], p_rank integer
) RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH agg AS (
    SELECT count(*)::int AS total_scores,
           coalesce(sum(CASE WHEN (e->>'is_fc')::boolean THEN 1 ELSE 0 END), 0)::int AS total_fcs,
           coalesce(sum((e->>'score')::bigint), 0)::bigint AS total_score,
           coalesce(sum((e->>'percent')::float), 0)::float AS total_percent
    FROM unnest(coalesce(p_scores, '{}'::jsonb[]) ||
                coalesce(p_unknown_scores, '{}'::jsonb[])) AS e
  )
  SELECT jsonb_build_object(
    'total_scores', total_scores,
    'total_fcs',    total_fcs,
    'total_score',  total_score,
    'avg_percent',  (CASE WHEN total_scores > 0 THEN total_percent / total_scores ELSE 0 END)::float,
    'rank',         p_rank
  ) FROM agg;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.stats := compute_user_stats_jsonb(
        NEW.scores,
        NEW.unknown_scores,
        CASE WHEN NEW.elo IS NOT NULL THEN (OLD.stats->>'rank')::int ELSE NULL END
    );

    NEW.scores_updated_at := now();

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_all_user_stats()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    WITH ranked_users AS (
        SELECT id, RANK() OVER (ORDER BY elo DESC) AS rank
        FROM users
        WHERE elo IS NOT NULL
    ),
    with_rank AS (
        SELECT u.id, r.rank::int AS rank
        FROM users u
        LEFT JOIN ranked_users r ON r.id = u.id
    )
    UPDATE users u
       SET stats = compute_user_stats_jsonb(u.scores, u.unknown_scores, wr.rank)
      FROM with_rank wr
     WHERE wr.id = u.id;
END;
$function$;

COMMIT;
