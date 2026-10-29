-- Additive setup: existing users, venues and bookings are preserved.
BEGIN;
CREATE TABLE IF NOT EXISTS approver_requests (
    request_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users,
    access_id INTEGER NOT NULL REFERENCES approval_groups,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by INTEGER REFERENCES users,
    remarks TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_approver_request ON approver_requests(user_id, access_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS venue_blackouts (
    blackout_id SERIAL PRIMARY KEY, venue_id INTEGER NOT NULL REFERENCES venues,
    start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ NOT NULL CHECK(end_time>start_time),
    reason TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS blackout_range ON venue_blackouts(venue_id,start_time,end_time) WHERE cancelled_at IS NULL;
CREATE TABLE IF NOT EXISTS user_notifications (
    notification_id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users,
    message TEXT NOT NULL, application_id INTEGER REFERENCES applications,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), read_at TIMESTAMPTZ,
    email_sent_at TIMESTAMPTZ, email_attempts INTEGER NOT NULL DEFAULT 0,
    email_claimed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user ON user_notifications(user_id,created_at);
CREATE TABLE IF NOT EXISTS password_resets (
    reset_id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users,
    token_hash VARCHAR(64) UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS admin_events (
    event_id SERIAL PRIMARY KEY, actor_user_id INTEGER NOT NULL REFERENCES users,
    action VARCHAR(80) NOT NULL, target_id INTEGER, details TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS amenities TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS booking_lookup ON booking_slots(venue_id,start_time,end_time);
CREATE UNIQUE INDEX IF NOT EXISTS unique_reviewer_vote ON approval_events(approval_id,actor_user_id);
-- These are backend-only tables. Supabase's public API gets no access policies.
ALTER TABLE approver_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_events ENABLE ROW LEVEL SECURITY;
COMMIT;
