const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meeting.controller');
const recordingController = require('../controllers/recording.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', meetingController.create);
router.get('/mine', meetingController.listMine);
router.get('/:meetingId', meetingController.getById);
router.post('/:meetingId/join', meetingController.join);
router.post('/:meetingId/end', meetingController.end);
router.post('/:meetingId/invite', meetingController.invite);
router.patch('/:meetingId/settings', meetingController.updateSettings);
router.post('/:meetingId/transfer-host', meetingController.transferHost);

// Recording
router.post('/:meetingId/recording/start', recordingController.startRecording);
router.post('/:meetingId/recording/stop', recordingController.stopRecording);
router.get('/:meetingId/recordings', recordingController.listRecordings);

module.exports = router;
