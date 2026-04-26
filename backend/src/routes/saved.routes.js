const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authRequired } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');
const {
  listSavedResources,
  saveResource,
  removeSavedResource,
} = require('../controllers/saved.controller');

router.use(authRequired);

router.get('/', listSavedResources);

router.post(
  '/',
  [
    body('resourceId').isUUID(),
    validateRequest,
  ],
  saveResource
);

router.delete(
  '/:resourceId',
  [
    param('resourceId').isUUID(),
    validateRequest,
  ],
  removeSavedResource
);

module.exports = router;