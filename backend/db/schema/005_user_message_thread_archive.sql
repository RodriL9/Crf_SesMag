-- Admin can archive a member chat (soft-hide from active inbox; messages retained).
CREATE TABLE IF NOT EXISTS user_message_thread_archive (
    member_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    archived_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_um_thread_archive_at ON user_message_thread_archive (archived_at DESC);
