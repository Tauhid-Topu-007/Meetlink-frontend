const attendanceService = require('../services/attendance.service');
const Meeting = require('../models/Meeting');

exports.getAttendance = async (req, res, next) => {
  try {
    const summary = await attendanceService.getAttendanceSummary(req.params.meetingId);
    // Only host/co-host or participant can view
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId.toUpperCase() });
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    const uid = req.user._id.toString();
    const isParticipant =
      meeting.isHostOrCoHost(req.user._id) ||
      meeting.participants.some((p) => p.userId.toString() === uid);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, attendance: summary });
  } catch (err) {
    next(err);
  }
};

exports.downloadExcel = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId.toUpperCase() });
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (!meeting.isHostOrCoHost(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only host or co-host can export attendance' });
    }

    const { buffer, filename } = await attendanceService.generateAttendanceExcel(
      req.params.meetingId
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
};