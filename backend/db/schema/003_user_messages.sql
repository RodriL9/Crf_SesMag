-- Messages from registered users to administrators (general requests beyond flags / ZIP workflow).
CREATE TABLE IF NOT EXISTS user_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_messages_body_not_blank CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON user_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_sender ON user_messages (sender_user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at ON user_messages (created_at DESC);
