-- 012: songs_new optimal score and paths

BEGIN;

ALTER TABLE public.songs_new
  ADD COLUMN IF NOT EXISTS optimal_score integer,
  ADD COLUMN IF NOT EXISTS paths         jsonb;

COMMENT ON COLUMN public.songs_new.optimal_score IS
  'Hydra optimal score (Expert Pro Drums, 2x bass). NULL until analysed.';
COMMENT ON COLUMN public.songs_new.paths IS
  'Hydra paths tied for optimal, highest first: [{score, path, breakdown}].';

COMMIT;

-- Verification:
  -- SELECT count(*) FILTER (WHERE optimal_score IS NOT NULL) AS analysed,
  --        count(*) FILTER (WHERE paths IS NOT NULL)         AS with_paths
  -- FROM songs_new; -- both 0 right after applying, equal after an import
