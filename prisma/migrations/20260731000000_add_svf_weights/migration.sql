-- Add per-mosque SVF weight overrides (nullable JSON).
-- NULL means "use the code-level SVF_DEFAULTS from src/lib/svf.js".
ALTER TABLE "MosqueSettings" ADD COLUMN IF NOT EXISTS "svfWeights" JSONB;
