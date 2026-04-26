const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev_only_secret_change_me';
}

function getJwtExpiry() {
  return process.env.JWT_EXPIRATION || '1d';
}

function signAccessToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiry() });
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};
