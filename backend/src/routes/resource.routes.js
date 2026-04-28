const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');
const { authRequired } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');
const { searchResources, getResourceById, verifyResource } = require('../controllers/resource.controller');

router.get(
  '/search',
  [
    query('zip').optional().isPostalCode('US'),
    query('city').optional().trim().isLength({ min: 2, max: 120 }),
    query('categoryId').optional().isInt({ min: 1 }),
    query('q').optional().isLength({ max: 120 }),
    validateRequest,
  ],
  searchResources
);

router.get(
  '/:id',
  [
    param('id').isUUID(),
    validateRequest,
  ],
  getResourceById
);

router.post(
  '/:id/verify',
  [
    authRequired,
    param('id').isUUID(),
    validateRequest,
  ],
  verifyResource
);

module.exports = router;