-- Add fields without replacing the existing campus catalog or bookings.
BEGIN;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS expected_attendance INTEGER CHECK (expected_attendance > 0);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_booking_slots_availability ON booking_slots (venue_id, start_time, end_time)
    WHERE slot_status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications (applicant_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_application ON application_approvals (application_id, approval_step);
COMMIT;
