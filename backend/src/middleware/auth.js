const { verifyAccessToken } = require('../utils/jwt');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid authorization token.' });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Session expired or token is invalid.' });
  }
}

function authOptional(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next();
  }

  try {
    req.user = verifyAccessToken(token);
  } catch {
    req.user = undefined;
  }

  return next();
}

module.exports = { authRequired, authOptional };
