const pool = require('../config/db');

async function listSavedResources(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         sr.id AS saved_id,
         sr.created_at AS saved_at,
         r.id,
         r.name,
         r.address,
         r.city,
         r.state,
         r.zip_code,
         r.phone_number,
         r.website,
         c.name AS category_name
       FROM saved_resources sr
       JOIN resources r ON r.id = sr.resource_id
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE sr.user_id = $1
       ORDER BY sr.created_at DESC;`,
      [req.user.sub]
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function saveResource(req, res, next) {
  const { resourceId } = req.body;

  try {
    const resourceResult = await pool.query('SELECT id FROM resources WHERE id = $1 LIMIT 1;', [resourceId]);
    if (resourceResult.rowCount === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    const result = await pool.query(
      `INSERT INTO saved_resources (user_id, resource_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, resource_id) DO NOTHING
       RETURNING id, user_id, resource_id, created_at;`,
      [req.user.sub, resourceId]
    );

    if (result.rowCount === 0) {
      return res.status(200).json({ message: 'Resource is already saved.' });
    }

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function removeSavedResource(req, res, next) {
  const resourceId = req.params.resourceId;

  try {
    const result = await pool.query(
      'DELETE FROM saved_resources WHERE user_id = $1 AND resource_id = $2 RETURNING id;',
      [req.user.sub, resourceId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Saved resource not found.' });
    }

    return res.json({ message: 'Saved resource removed.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listSavedResources,
  saveResource,
  removeSavedResource,
};
