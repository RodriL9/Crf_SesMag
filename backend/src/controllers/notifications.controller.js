const pool = require('../config/db');

async function listUserNotifications(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         ral.id AS notification_id,
         ral.action,
         ral.created_at,
         ral.changes,
         r.id AS resource_id,
         r.name AS resource_name,
         r.address,
         r.city,
         r.state,
         r.zip_code,
         c.name AS category_name
       FROM saved_resources sr
       JOIN resource_audit_log ral ON ral.resource_id = sr.resource_id
       JOIN resources r ON r.id = sr.resource_id
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE sr.user_id = $1
       ORDER BY ral.created_at DESC
       LIMIT 100;`,
      [req.user.sub]
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listUserNotifications,
};
