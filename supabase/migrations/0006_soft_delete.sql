-- 0006_soft_delete.sql
-- Add soft-delete (deleted_at) and sent timestamp (sent_at) columns.

ALTER TABLE requests ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sent_at     timestamptz DEFAULT NULL;

-- Partial index so queries that filter out deleted rows stay fast.
CREATE INDEX IF NOT EXISTS idx_requests_not_deleted
  ON requests (user_id, created_at DESC)
  WHERE deleted_at IS NULL;
