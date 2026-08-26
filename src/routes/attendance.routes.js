const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/:meetingId', attendanceController.getAttendance);
router.get('/:meetingId/excel', attendanceController.downloadExcel);

module.exports = router;