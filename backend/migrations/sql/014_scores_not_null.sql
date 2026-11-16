-- 014: users.scores and unknown_scores default to an empty array, never NULL

BEGIN;

UPDATE public.users SET scores = '{}' WHERE scores IS NULL;
UPDATE public.users SET unknown_scores = '{}' WHERE unknown_scores IS NULL;

ALTER TABLE public.users
  ALTER COLUMN scores SET DEFAULT '{}',
  ALTER COLUMN scores SET NOT NULL,
  ALTER COLUMN unknown_scores SET DEFAULT '{}',
  ALTER COLUMN unknown_scores SET NOT NULL;

COMMIT;

-- Verification:
--   SELECT count(*) FILTER (WHERE scores IS NULL)         AS null_scores,
--          count(*) FILTER (WHERE unknown_scores IS NULL) AS null_unknown
--   FROM users; -- both 0
--   SELECT column_name, column_default, is_nullable FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'users'
--     AND column_name IN ('scores', 'unknown_scores'); -- default '{}'::jsonb[], is_nullable NO
