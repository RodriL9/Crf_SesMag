const express = require('express');
const { body, param } = require('express-validator');
const { authOptional } = require('../middleware/auth');
const { authRequired } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');
const {
  createSubmission,
  listMySubmissions,
  withdrawMyZipSubmission,
} = require('../controllers/submission.controller');

const router = express.Router();

router.post(
  '/',
  [
    authOptional,
    body('zipOrCity').trim().isLength({ min: 2, max: 120 }),
    body('categoryId').custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const n = typeof value === 'number' ? value : parseInt(String(value), 10);
      if (!Number.isInteger(n) || n < 1 || n > 6) {
        throw new Error('categoryId must be 1–6 or omitted for anonymous all-types suggestions.');
      }
      return true;
    }),
    body('resourceName').optional({ nullable: true }).trim().isLength({ max: 255 }),
    body('submitterName').optional({ nullable: true }).trim().isLength({ max: 120 }),
    body('submitterContact').optional({ nullable: true }).trim().isLength({ max: 255 }),
    body('address').optional({ nullable: true }).trim().isLength({ max: 255 }),
    body('phoneNumber').optional({ nullable: true }).trim().isLength({ max: 20 }),
    body('website').optional({ nullable: true }).trim().isLength({ max: 255 }),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    validateRequest,
  ],
  createSubmission
);

router.get('/mine', authRequired, listMySubmissions);

router.delete(
  '/:id',
  authRequired,
  [param('id').isUUID(), validateRequest],
  withdrawMyZipSubmission
);

module.exports = router;
