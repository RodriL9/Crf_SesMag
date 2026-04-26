const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validate');
const {
  register,
  login,
  googleLogin,
  verifyEmail,
  resendVerificationEmail,
} = require('../controllers/auth.controller');

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 120 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 128 }),
    validateRequest,
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 }),
    validateRequest,
  ],
  login
);

router.post(
  '/google',
  [
    body('idToken').isString().isLength({ min: 20 }),
    validateRequest,
  ],
  googleLogin
);

router.post(
  '/verify-email',
  [
    body('token').isString().isLength({ min: 10 }),
    validateRequest,
  ],
  verifyEmail
);

router.post(
  '/resend-verification',
  [
    body('email').isEmail().normalizeEmail(),
    validateRequest,
  ],
  resendVerificationEmail
);

module.exports = router;