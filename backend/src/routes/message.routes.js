const express = require('express');
const { body } = require('express-validator');
const { authRequired } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');
const { createUserMessage, listMyMessages } = require('../controllers/message.controller');

const router = express.Router();

router.post(
  '/',
  authRequired,
  [body('body').trim().isLength({ min: 1, max: 8000 }), validateRequest],
  createUserMessage
);

router.get('/', authRequired, listMyMessages);

module.exports = router;
