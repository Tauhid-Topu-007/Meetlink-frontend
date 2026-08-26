const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', notificationController.list);
router.post('/read', notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);

module.exports = router;