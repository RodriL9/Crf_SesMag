const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { signAccessToken } = require('../utils/jwt');

function fullName(firstName, lastName, fallbackEmail = '') {
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return joined || fallbackEmail.split('@')[0] || 'User';
}

async function getAccount(req, res, next) {
  const userId = req.user.sub;

  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, role, is_verified, created_at, updated_at
       FROM users
       WHERE id = $1
       LIMIT 1;`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const u = result.rows[0];
    return res.json({
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      name: fullName(u.first_name, u.last_name, u.email),
      role: u.role,
      isEmailVerified: u.is_verified,
      created_at: u.created_at,
      updated_at: u.updated_at,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateAccount(req, res, next) {
  const { email, currentPassword, newPassword } = req.body;
  const userId = req.user.sub;

  try {
    const currentResult = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_verified FROM users WHERE id = $1 LIMIT 1;',
      [userId]
    );

    if (currentResult.rowCount === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const currentUser = currentResult.rows[0];
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail !== currentUser.email) {
      return res.status(400).json({ error: 'Email changes are disabled for this account.' });
    }

    let nextPasswordHash = currentUser.password_hash;
    if (newPassword) {
      if (!currentUser.password_hash) {
        return res.status(400).json({ error: 'Password change is unavailable for this account.' });
      }
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
      nextPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedResult = await pool.query(
      `UPDATE users
       SET email = $1,
           password_hash = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, first_name, last_name, email, role, is_verified;`,
      [currentUser.email, nextPasswordHash, userId]
    );

    const updatedUser = updatedResult.rows[0];
    const token = signAccessToken({
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      name: fullName(updatedUser.first_name, updatedUser.last_name, updatedUser.email),
    });

    return res.json({
      message: 'Account settings updated.',
      token,
      user: {
        id: updatedUser.id,
        name: fullName(updatedUser.first_name, updatedUser.last_name, updatedUser.email),
        email: updatedUser.email,
        role: updatedUser.role,
        isEmailVerified: updatedUser.is_verified,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteAccount(req, res, next) {
  const { currentPassword } = req.body;
  const userId = req.user.sub;

  try {
    const userResult = await pool.query('SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1;', [userId]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const user = userResult.rows[0];
    if (!user.password_hash) {
      return res.status(400).json({ error: 'Password confirmation is unavailable for this account type.' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1;', [userId]);
    return res.json({ message: 'Account deleted.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAccount,
  updateAccount,
  deleteAccount,
};
