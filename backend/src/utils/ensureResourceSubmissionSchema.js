/** Older DBs may still have NOT NULL on category_id; anonymous suggestions need NULL. */
let resourceSubmissionCategoryNullableEnsured = false;

async function ensureResourceSubmissionCategoryNullable(pool) {
  if (resourceSubmissionCategoryNullableEnsured) return;
  await pool.query(`
    ALTER TABLE resource_submissions
    ALTER COLUMN category_id DROP NOT NULL;
  `);
  resourceSubmissionCategoryNullableEnsured = true;
}

module.exports = { ensureResourceSubmissionCategoryNullable };
