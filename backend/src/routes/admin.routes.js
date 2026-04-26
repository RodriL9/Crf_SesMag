const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authRequired } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validateRequest } = require('../middleware/validate');
const {
  listResources,
  createResource,
  updateResource,
  getResourceAuditLog,
  listResourceSubmissions,
  updateResourceSubmissionStatus,
} = require('../controllers/admin.controller');

router.use(authRequired, requireRole('admin'));

router.get('/resources', listResources);

router.post(
  '/resources',
  [
    body('name').trim().isLength({ min: 2, max: 255 }),
    body('address').trim().isLength({ min: 4, max: 500 }),
    body('categoryId').optional({ nullable: true }).isInt({ min: 1 }),
    body('isVerified').optional().isBoolean(),
    validateRequest,
  ],
  createResource
);

router.patch(
  '/resources/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 2, max: 255 }),
    body('address').optional().trim().isLength({ min: 4, max: 500 }),
    body('categoryId').optional({ nullable: true }).isInt({ min: 1 }),
    body('isVerified').optional().isBoolean(),
    validateRequest,
  ],
  updateResource
);

router.get(
  '/resources/:id/audit-log',
  [
    param('id').isUUID(),
    validateRequest,
  ],
  getResourceAuditLog
);

router.get('/submissions', listResourceSubmissions);

router.patch(
  '/submissions/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(['pending', 'approved', 'rejected']),
    body('reviewNotes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    validateRequest,
  ],
  updateResourceSubmissionStatus
);

module.exports = router;