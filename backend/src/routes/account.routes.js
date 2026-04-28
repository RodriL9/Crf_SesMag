const express = require('express');
const { body } = require('express-validator');
const { authRequired } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');
const { getAccount, updateAccount, deleteAccount } = require('../controllers/account.controller');

const router = express.Router();

router.use(authRequired);

router.get('/', getAccount);

router.patch(
  '/',
  [
    body('email').isEmail().normalizeEmail(),
    body('newPassword').optional({ nullable: true }).isLength({ min: 8, max: 128 }),
    body('currentPassword')
      .optional({ nullable: true })
      .isLength({ min: 1, max: 128 }),
    validateRequest,
  ],
  updateAccount
);

router.delete(
  '/',
  [
    body('currentPassword').isLength({ min: 1, max: 128 }),
    validateRequest,
  ],
  deleteAccount
);

module.exports = router;
