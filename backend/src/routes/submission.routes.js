const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validate');
const { createSubmission } = require('../controllers/submission.controller');

const router = express.Router();

router.post(
  '/',
  [
    body('zipOrCity').trim().isLength({ min: 2, max: 120 }),
    body('categoryId').isInt({ min: 1, max: 6 }),
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

module.exports = router;
