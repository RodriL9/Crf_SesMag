const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authRequired } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validateRequest } = require('../middleware/validate');
const {
  listResources,
  createResource,
  importZipResources,
  updateResource,
  getResourceAuditLog,
  listResourceSubmissions,
  updateResourceSubmissionStatus,
  deleteResourceSubmission,
  listUsers,
  deleteUser,
  listUserMessages,
  createAdminThreadMessage,
  archiveMessageThread,
  unarchiveMessageThread,
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

router.post(
  '/resources/import-zip',
  [
    body('zipCode').trim().matches(/^\d{5}$/),
    validateRequest,
  ],
  importZipResources
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

router.get('/messages', listUserMessages);

router.post(
  '/messages',
  [
    body('threadUserId').isUUID(),
    body('body').trim().isLength({ min: 1, max: 8000 }),
    validateRequest,
  ],
  createAdminThreadMessage
);

router.post(
  '/messages/archive',
  [body('threadUserId').isUUID(), validateRequest],
  archiveMessageThread
);

router.post(
  '/messages/unarchive',
  [body('threadUserId').isUUID(), validateRequest],
  unarchiveMessageThread
);

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

router.delete(
  '/submissions/:id',
  [
    param('id').isUUID(),
    validateRequest,
  ],
  deleteResourceSubmission
);

router.get('/users', listUsers);

router.delete(
  '/users/:id',
  [
    param('id').isUUID(),
    body('currentPassword').trim().notEmpty().withMessage('Your admin password is required.'),
    validateRequest,
  ],
  deleteUser
);

module.exports = router;