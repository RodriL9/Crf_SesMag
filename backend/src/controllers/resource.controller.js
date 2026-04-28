const pool = require('../config/db');

async function searchResources(req, res, next) {
  const { zip, city, categoryId, q } = req.query;

  try {
    const params = [];
    const conditions = [];

    if (zip) {
      params.push(zip);
      conditions.push(`r.zip_code = $${params.length}`);
    }

    if (categoryId) {
      params.push(Number(categoryId));
      conditions.push(`r.category_id = $${params.length}`);
    }

    if (city) {
      params.push(`%${city}%`);
      conditions.push(`COALESCE(r.city, '') ILIKE $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      conditions.push(
        `(r.name ILIKE $${params.length}
          OR COALESCE(r.description, '') ILIKE $${params.length}
          OR COALESCE(r.city, '') ILIKE $${params.length}
          OR COALESCE(r.zip_code, '') ILIKE $${params.length})`
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT
        r.id, r.name, r.description, r.address, r.city, r.state, r.zip_code,
        r.phone_number, r.hours_of_operation, r.website, r.requirements,
        r.is_verified, r.verified_at, r.latitude, r.longitude,
        c.id AS category_id, c.name AS category_name
      FROM resources r
      LEFT JOIN categories c ON c.id = r.category_id
      ${whereClause}
      ORDER BY r.is_verified DESC, r.name ASC
      LIMIT 200;
    `;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function getResourceById(req, res, next) {
  const id = req.params.id;

  try {
    const result = await pool.query(
      `SELECT
         r.id, r.name, r.description, r.address, r.city, r.state, r.zip_code,
         r.phone_number, r.hours_of_operation, r.website, r.requirements,
         r.is_verified, r.verified_at, r.latitude, r.longitude,
         c.id AS category_id, c.name AS category_name
       FROM resources r
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.id = $1
       LIMIT 1;`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function verifyResource(req, res, next) {
  const resourceId = req.params.id;
  const actorId = req.user.sub;

  try {
    const currentResult = await pool.query(
      'SELECT id, is_verified FROM resources WHERE id = $1 LIMIT 1;',
      [resourceId]
    );

    if (currentResult.rowCount === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    const current = currentResult.rows[0];
    if (current.is_verified) {
      return res.json({ message: 'Resource is already verified.', resourceId, isVerified: true });
    }

    await pool.query(
      `UPDATE resources
       SET is_verified = TRUE,
           verified_at = COALESCE(verified_at, NOW()),
           verified_by = COALESCE(verified_by, $2),
           updated_at = NOW()
       WHERE id = $1;`,
      [resourceId, actorId]
    );

    await pool.query(
      `INSERT INTO resource_audit_log (resource_id, changed_by, action, changes)
       VALUES ($1, $2, 'verified', $3::jsonb);`,
      [
        resourceId,
        actorId,
        JSON.stringify({
          before: { is_verified: false },
          after: { is_verified: true },
        }),
      ]
    );

    return res.json({ message: 'Resource verified successfully.', resourceId, isVerified: true });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  searchResources,
  getResourceById,
  verifyResource,
};
