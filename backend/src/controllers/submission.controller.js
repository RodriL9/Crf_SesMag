const pool = require('../config/db');

async function createSubmission(req, res, next) {
  const {
    zipOrCity,
    categoryId,
    resourceName,
    notes,
  } = req.body;

  try {
    const finalResourceName = resourceName?.trim() || `Resource suggestion for ${zipOrCity}`;

    const result = await pool.query(
      `INSERT INTO resource_submissions (
         submitter_name, submitter_contact, zip_or_city, category_id,
         resource_name, address, phone_number, website, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, status, created_at;`,
      [
        null,
        null,
        zipOrCity,
        categoryId,
        finalResourceName,
        null,
        null,
        null,
        notes || null,
      ]
    );

    return res.status(201).json({
      message: 'Suggestion submitted for admin review.',
      submission: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createSubmission,
};
