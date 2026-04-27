const express = require('express');
const { authRequired } = require('../middleware/auth');
const { listUserNotifications } = require('../controllers/notifications.controller');

const router = express.Router();

router.use(authRequired);
router.get('/', listUserNotifications);

module.exports = router;
