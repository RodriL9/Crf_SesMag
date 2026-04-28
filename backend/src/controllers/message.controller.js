const pool = require('../config/db');
const { ensureUserMessageArchiveTable } = require('../utils/ensureMessageArchiveTable');

async function createUserMessage(req, res, next) {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Admins reply from the admin Messages screen.' });
  }

  const text = (req.body.body || '').trim();

  const client = await pool.connect();
  try {
    await ensureUserMessageArchiveTable(pool);
    await client.query('BEGIN');
    await client.query(`DELETE FROM user_message_thread_archive WHERE member_user_id = $1`, [req.user.sub]);
    const result = await client.query(
      `INSERT INTO user_messages (user_id, body, sender_user_id)
       VALUES ($1, $2, $1)
       RETURNING id, body, created_at, sender_user_id;`,
      [req.user.sub, text]
    );
    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Message sent.',
      row: result.rows[0],
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return next(error);
  } finally {
    client.release();
  }
}

async function listMyMessages(req, res, next) {
  if (req.user.role === 'admin') {
    return res.json({ messages: [], threadArchivedByStaff: false });
  }

  try {
    await ensureUserMessageArchiveTable(pool);
    const result = await pool.query(
      `SELECT
         um.id,
         um.body,
         um.created_at,
         um.sender_user_id,
         NULLIF(TRIM(CONCAT(COALESCE(su.first_name, ''), ' ', COALESCE(su.last_name, ''))), '') AS sender_name,
         su.role AS sender_role
       FROM user_messages um
       JOIN users su ON su.id = um.sender_user_id
       WHERE um.user_id = $1
       ORDER BY um.created_at ASC
       LIMIT 500;`,
      [req.user.sub]
    );

    const arch = await pool.query(
      `SELECT 1 FROM user_message_thread_archive WHERE member_user_id = $1 LIMIT 1;`,
      [req.user.sub]
    );

    return res.json({
      messages: result.rows,
      threadArchivedByStaff: arch.rowCount > 0,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUserMessage,
  listMyMessages,
};
