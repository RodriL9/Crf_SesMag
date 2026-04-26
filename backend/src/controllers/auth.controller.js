const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { signAccessToken } = require('../utils/jwt');
const { generateToken } = require('../utils/randomToken');
const { sendVerificationEmail } = require('../services/gmail.service');
const { verifyGoogleIdToken } = require('../services/googleOAuth.service');

function buildVerificationUrl(token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  return `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

function splitName(fullName = '') {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  const firstName = parts.shift();
  const lastName = parts.length > 0 ? parts.join(' ') : null;
  return { firstName, lastName };
}

function fullName(firstName, lastName, fallbackEmail = '') {
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return joined || fallbackEmail.split('@')[0] || 'User';
}

async function issueVerificationToken(userId) {
  const token = generateToken(24);
  await pool.query(
    `UPDATE users
     SET verification_token = $1, updated_at = NOW()
     WHERE id = $2;`,
    [token, userId]
  );
  return token;
}

async function register(req, res, next) {
  const { name, email, password, role = 'user' } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1;', [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const { firstName, lastName } = splitName(name);
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING id, first_name, last_name, email, role, is_verified;`,
      [email.toLowerCase(), passwordHash, firstName, lastName, role]
    );

    const user = created.rows[0];
    const verificationToken = await issueVerificationToken(user.id);
    const verificationUrl = buildVerificationUrl(verificationToken);
    const emailResult = await sendVerificationEmail({
      to: user.email,
      name: fullName(user.first_name, user.last_name, user.email),
      verificationUrl,
    });

    return res.status(201).json({
      message: 'Account created. Verify your email to fully activate your account.',
      user: {
        id: user.id,
        name: fullName(user.first_name, user.last_name, user.email),
        email: user.email,
        role: user.role,
        isEmailVerified: user.is_verified,
      },
      verification: emailResult,
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, first_name, last_name, email, role, is_verified, password_hash FROM users WHERE email = $1;',
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Use Google sign-in for this account.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: fullName(user.first_name, user.last_name, user.email),
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: fullName(user.first_name, user.last_name, user.email),
        email: user.email,
        role: user.role,
        isEmailVerified: user.is_verified,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function googleLogin(req, res, next) {
  const { idToken } = req.body;

  try {
    const payload = await verifyGoogleIdToken(idToken);
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Unable to validate Google identity.' });
    }

    const email = payload.email.toLowerCase();
    const googleSub = payload.sub;
    const name = payload.name || email.split('@')[0];
    const { firstName, lastName } = splitName(name);

    let userResult = await pool.query(
      `SELECT id, first_name, last_name, email, role, is_verified
       FROM users
       WHERE google_id = $1 OR email = $2
       LIMIT 1;`,
      [googleSub, email]
    );

    if (userResult.rowCount === 0) {
      userResult = await pool.query(
        `INSERT INTO users (first_name, last_name, email, role, is_verified, google_id)
         VALUES ($1, $2, $3, 'user', TRUE, $4)
         RETURNING id, first_name, last_name, email, role, is_verified;`,
        [firstName, lastName, email, googleSub]
      );
    } else {
      const user = userResult.rows[0];
      await pool.query(
        `UPDATE users
         SET google_id = COALESCE(google_id, $1),
             is_verified = TRUE,
             updated_at = NOW()
         WHERE id = $2;`,
        [googleSub, user.id]
      );
    }

    const user = userResult.rows[0];
    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: fullName(user.first_name, user.last_name, user.email),
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: fullName(user.first_name, user.last_name, user.email),
        email: user.email,
        role: user.role,
        isEmailVerified: true,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyEmail(req, res, next) {
  const { token } = req.body;

  try {
    const tokenResult = await pool.query(
      `SELECT id
       FROM users
       WHERE verification_token = $1
       LIMIT 1;`,
      [token]
    );

    if (tokenResult.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    const user = tokenResult.rows[0];
    await pool.query(
      `UPDATE users
       SET is_verified = TRUE,
           verification_token = NULL,
           updated_at = NOW()
       WHERE id = $1;`,
      [user.id]
    );

    return res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    return next(error);
  }
}

async function resendVerificationEmail(req, res, next) {
  const { email } = req.body;

  try {
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, email, is_verified FROM users WHERE email = $1;',
      [email.toLowerCase()]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'No account found for this email.' });
    }

    const user = userResult.rows[0];
    if (user.is_verified) {
      return res.status(400).json({ error: 'This email is already verified.' });
    }

    const verificationToken = await issueVerificationToken(user.id);
    const verificationUrl = buildVerificationUrl(verificationToken);
    const emailResult = await sendVerificationEmail({
      to: user.email,
      name: fullName(user.first_name, user.last_name, user.email),
      verificationUrl,
    });

    return res.json({
      message: 'Verification email sent.',
      verification: emailResult,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  googleLogin,
  verifyEmail,
  resendVerificationEmail,
};
