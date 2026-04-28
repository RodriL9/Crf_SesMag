-- Track who sent each message (member vs admin) for two-way threads.
-- thread is keyed by user_id (always the member account).
ALTER TABLE user_messages
  ADD COLUMN IF NOT EXISTS sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE user_messages SET sender_user_id = user_id WHERE sender_user_id IS NULL;

ALTER TABLE user_messages ALTER COLUMN sender_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_messages_sender ON user_messages (sender_user_id);
