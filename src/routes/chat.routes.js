const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(protect);
router.post('/upload', upload.single('file'), chatController.uploadAttachment);
router.post('/messages', chatController.saveMessage);
router.get('/messages/:meetingId', chatController.getMeetingMessages);

module.exports = router;