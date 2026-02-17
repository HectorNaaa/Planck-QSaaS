-- Migration: add backend selection audit columns to execution_logs
-- All columns are nullable so existing rows and inserts stay compatible.

ALTER TABLE execution_logs
  ADD COLUMN IF NOT EXISTS backend_selected  TEXT,
  ADD COLUMN IF NOT EXISTS backend_reason    TEXT,
  ADD COLUMN IF NOT EXISTS backend_hint      TEXT,
  ADD COLUMN IF NOT EXISTS backend_metadata  JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS backend_assigned_at TIMESTAMPTZ;

-- Index for dashboard queries that filter/group by backend_selected
CREATE INDEX IF NOT EXISTS idx_execution_logs_backend_selected
  ON execution_logs (backend_selected);
