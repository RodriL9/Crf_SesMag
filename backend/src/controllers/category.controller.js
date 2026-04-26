const pool = require('../config/db');

async function getCategories(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, name, description FROM categories ORDER BY name ASC;'
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getCategories };
