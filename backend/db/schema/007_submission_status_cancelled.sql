-- Allow users to cancel ZIP requests without deleting the row (admin archive).
ALTER TABLE resource_submissions DROP CONSTRAINT IF EXISTS resource_submissions_status_check;
ALTER TABLE resource_submissions ADD CONSTRAINT resource_submissions_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));
