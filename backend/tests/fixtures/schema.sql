-- Test schema for a disposable local PostgreSQL database only.
BEGIN;
CREATE TABLE organizational_units (
    unit_id SERIAL PRIMARY KEY, unit_name VARCHAR(150) NOT NULL,
    unit_code VARCHAR(30), unit_type VARCHAR(40) NOT NULL,
    parent_unit_id INTEGER REFERENCES organizational_units
);
CREATE TABLE buildings (
    building_id SERIAL PRIMARY KEY, building_name VARCHAR(150) NOT NULL,
    owning_unit_id INTEGER REFERENCES organizational_units, location_description TEXT
);
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY, full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE, user_type VARCHAR(30) NOT NULL,
    home_unit_id INTEGER REFERENCES organizational_units, password_hash VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE approval_groups (
    access_id SERIAL PRIMARY KEY, group_name VARCHAR(150) NOT NULL,
    unit_id INTEGER NOT NULL REFERENCES organizational_units,
    approval_mode VARCHAR(20) NOT NULL DEFAULT 'any' CHECK (LOWER(approval_mode) IN ('any', 'all','minimum')),
    minimum_approvals INTEGER NOT NULL DEFAULT 1 CHECK (minimum_approvals > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE group_members (
    access_id INTEGER REFERENCES approval_groups, user_id INTEGER REFERENCES users,
    member_role VARCHAR(60) NOT NULL, can_approve BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), left_at TIMESTAMPTZ,
    PRIMARY KEY (access_id, user_id)
);
CREATE TABLE venues (
    venue_id SERIAL PRIMARY KEY, venue_name VARCHAR(150) NOT NULL,
    venue_type VARCHAR(50) NOT NULL, building_id INTEGER REFERENCES buildings,
    managing_unit_id INTEGER NOT NULL REFERENCES organizational_units,
    access_id INTEGER NOT NULL REFERENCES approval_groups,
    capacity INTEGER CHECK (capacity > 0), location_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE venue_additional_approvals (
    venue_id INTEGER REFERENCES venues, access_id INTEGER REFERENCES approval_groups,
    approval_step INTEGER NOT NULL CHECK (approval_step > 0), PRIMARY KEY (venue_id, access_id)
);
CREATE TABLE applications (
    application_id SERIAL PRIMARY KEY, applicant_user_id INTEGER NOT NULL REFERENCES users,
    venue_id INTEGER REFERENCES venues, target_access_id INTEGER REFERENCES approval_groups,
    application_type VARCHAR(40) NOT NULL, purpose VARCHAR(255) NOT NULL,
    description TEXT,
    faculty_advisor_id INTEGER REFERENCES users,
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled', 'needs_reassignment')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), submitted_at TIMESTAMPTZ
);
CREATE TABLE booking_slots (
    slot_id SERIAL PRIMARY KEY, application_id INTEGER NOT NULL REFERENCES applications,
    venue_id INTEGER NOT NULL REFERENCES venues, start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL CHECK (end_time > start_time),
    slot_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (slot_status IN ('pending', 'confirmed', 'cancelled')),
    confirmed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ
);
CREATE TABLE application_approvals (
    approval_id SERIAL PRIMARY KEY, application_id INTEGER NOT NULL REFERENCES applications,
    access_id INTEGER NOT NULL REFERENCES approval_groups, approval_step INTEGER NOT NULL,
    required_approvals INTEGER NOT NULL DEFAULT 1 CHECK (required_approvals > 0),
    approval_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    last_action_by_user_id INTEGER REFERENCES users, last_action_at TIMESTAMPTZ,
    remarks TEXT, UNIQUE (application_id, access_id)
);
CREATE TABLE approval_events (
    event_id SERIAL PRIMARY KEY, approval_id INTEGER NOT NULL REFERENCES application_approvals,
    access_id INTEGER NOT NULL REFERENCES approval_groups,
    actor_user_id INTEGER NOT NULL REFERENCES users, decision BOOLEAN NOT NULL,
    remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (approval_id, actor_user_id)
);
CREATE INDEX idx_booking_slots_availability ON booking_slots (venue_id, start_time, end_time)
    WHERE slot_status IN ('pending', 'confirmed');
CREATE INDEX idx_applications_applicant ON applications (applicant_user_id, created_at);
CREATE INDEX idx_approvals_application ON application_approvals (application_id, approval_step);
CREATE TABLE email_otps (
    id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL, otp_code VARCHAR(6) NOT NULL,
    payload JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, is_verified BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_email_otps_email ON email_otps (email);
COMMIT;
