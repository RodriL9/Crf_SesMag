-- Link resource_submissions to the logged-in user when present (for withdraw / audit).
ALTER TABLE resource_submissions
  ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resource_submissions_submitted_by
  ON resource_submissions (submitted_by_user_id);
