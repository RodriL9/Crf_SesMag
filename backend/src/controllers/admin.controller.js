const pool = require('../config/db');

async function listResources(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         r.id, r.name, r.description, r.address, r.city, r.state, r.zip_code,
         r.phone_number, r.hours_of_operation, r.website, r.requirements,
         r.category_id, c.name AS category_name, r.is_verified, r.verified_at
       FROM resources r
       LEFT JOIN categories c ON c.id = r.category_id
       ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
       LIMIT 500;`
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function createResource(req, res, next) {
  const {
    name,
    description,
    address,
    city,
    state,
    zipCode,
    phoneNumber,
    hoursOfOperation,
    website,
    requirements,
    categoryId,
    isVerified = false,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO resources (
         name, description, address, city, state, zip_code,
         phone_number, hours_of_operation, website, requirements,
         category_id, is_verified, verified_at, verified_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *;`,
      [
        name,
        description || null,
        address,
        city || null,
        state || 'NJ',
        zipCode || null,
        phoneNumber || null,
        hoursOfOperation || null,
        website || null,
        requirements || null,
        categoryId || null,
        Boolean(isVerified),
        isVerified ? new Date() : null,
        isVerified ? req.user.sub : null,
      ]
    );

    await pool.query(
      `INSERT INTO resource_audit_log (resource_id, changed_by, action, changes)
       VALUES ($1, $2, 'created', $3::jsonb);`,
      [
        result.rows[0].id,
        req.user.sub,
        JSON.stringify({ after: result.rows[0] }),
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function updateResource(req, res, next) {
  const resourceId = req.params.id;
  const {
    name,
    description,
    address,
    city,
    state,
    zipCode,
    phoneNumber,
    hoursOfOperation,
    website,
    requirements,
    categoryId,
    isVerified,
  } = req.body;

  try {
    const current = await pool.query('SELECT * FROM resources WHERE id = $1 LIMIT 1;', [resourceId]);
    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    const oldRow = current.rows[0];
    const nextIsVerified = typeof isVerified === 'boolean' ? isVerified : oldRow.is_verified;

    const updated = await pool.query(
      `UPDATE resources
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           address = COALESCE($3, address),
           city = COALESCE($4, city),
           state = COALESCE($5, state),
           zip_code = COALESCE($6, zip_code),
           phone_number = COALESCE($7, phone_number),
           hours_of_operation = COALESCE($8, hours_of_operation),
           website = COALESCE($9, website),
           requirements = COALESCE($10, requirements),
           category_id = COALESCE($11, category_id),
           is_verified = $12,
           verified_at = CASE WHEN $12 = TRUE THEN COALESCE(verified_at, NOW()) ELSE NULL END,
           verified_by = CASE WHEN $12 = TRUE THEN COALESCE(verified_by, $14) ELSE NULL END,
           updated_at = NOW()
       WHERE id = $13
       RETURNING *;`,
      [
        name ?? null,
        description ?? null,
        address ?? null,
        city ?? null,
        state ?? null,
        zipCode ?? null,
        phoneNumber ?? null,
        hoursOfOperation ?? null,
        website ?? null,
        requirements ?? null,
        categoryId ?? null,
        nextIsVerified,
        resourceId,
        nextIsVerified ? req.user.sub : null,
      ]
    );

    await pool.query(
      `INSERT INTO resource_audit_log (resource_id, changed_by, action, changes)
       VALUES ($1, $2, 'updated', $3::jsonb);`,
      [
        resourceId,
        req.user.sub,
        JSON.stringify({
          before: oldRow,
          after: updated.rows[0],
        }),
      ]
    );

    return res.json(updated.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function getResourceAuditLog(req, res, next) {
  const resourceId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT
         ral.id,
         ral.resource_id,
         ral.action,
         ral.changes,
         ral.created_at,
         u.id AS changed_by_user_id,
         CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS changed_by_name,
         u.email AS changed_by_email
       FROM resource_audit_log ral
       LEFT JOIN users u ON u.id = ral.changed_by
       WHERE ral.resource_id = $1
       ORDER BY ral.created_at DESC;`,
      [resourceId]
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function listResourceSubmissions(req, res, next) {
  const status = req.query.status;

  try {
    const params = [];
    let whereClause = '';

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      params.push(status);
      whereClause = `WHERE rs.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         rs.id, rs.submitter_name, rs.submitter_contact, rs.zip_or_city,
         rs.category_id, c.name AS category_name, rs.resource_name, rs.address,
         rs.phone_number, rs.website, rs.notes, rs.status, rs.review_notes,
         rs.reviewed_by, rs.reviewed_at, rs.created_at, rs.updated_at
       FROM resource_submissions rs
       LEFT JOIN categories c ON c.id = rs.category_id
       ${whereClause}
       ORDER BY rs.created_at DESC;`,
      params
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function updateResourceSubmissionStatus(req, res, next) {
  const submissionId = req.params.id;
  const { status, reviewNotes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE resource_submissions
       SET status = $1,
           review_notes = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *;`,
      [status, reviewNotes || null, req.user.sub, submissionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listResources,
  createResource,
  updateResource,
  getResourceAuditLog,
  listResourceSubmissions,
  updateResourceSubmissionStatus,
};
