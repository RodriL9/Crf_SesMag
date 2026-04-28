-- Anonymous "suggest a resource" may apply to all categories (no single type).
ALTER TABLE resource_submissions
  ALTER COLUMN category_id DROP NOT NULL;
