const meetingService = require('../services/meeting.service');
const Meeting = require('../models/Meeting');

exports.create = async (req, res, next) => {
  try {
    const meeting = await meetingService.createMeeting(req.user, req.body);
    res.status(201).json({
      success: true,
      meeting: {
        meetingId: meeting.meetingId,
        title: meeting.title,
        type: meeting.type,
        status: meeting.status,
        invitationToken: meeting.invitationToken,
        joinLink: `${process.env.CLIENT_URL || 'http://localhost:5173'}/join/${meeting.meetingId}`,
        scheduledStart: meeting.scheduledStart,
        hasPassword: meeting.hasPassword,
        waitingRoomEnabled: meeting.waitingRoomEnabled,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const meeting = await meetingService.getMeetingById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    res.json({ success: true, meeting });
  } catch (err) {
    next(err);
  }
};

exports.join = async (req, res, next) => {
  try {
    const meeting = await meetingService.getMeetingById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    const result = await meetingService.joinMeeting(meeting, req.user, {
      password: req.body.password,
    });
    res.json({
      success: true,
      needsApproval: result.needsApproval,
      meeting: {
        meetingId: result.meeting.meetingId,
        title: result.meeting.title,
        status: result.meeting.status,
        hostId: result.meeting.hostId,
        settings: result.meeting.settings,
        waitingRoomEnabled: result.meeting.waitingRoomEnabled,
        locked: result.meeting.locked,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.end = async (req, res, next) => {
  try {
    const meeting = await meetingService.getMeetingById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    const updated = await meetingService.endMeeting(meeting, req.user._id);
    res.json({ success: true, meeting: updated });
  } catch (err) {
    next(err);
  }
};

exports.invite = async (req, res, next) => {
  try {
    const meeting = await meetingService.getMeetingById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (!meeting.isHostOrCoHost(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only host/co-host can invite' });
    }
    const emails = Array.isArray(req.body.emails) ? req.body.emails : [req.body.email].filter(Boolean);
    if (!emails.length) {
      return res.status(400).json({ success: false, message: 'At least one email required' });
    }
    const results = await meetingService.inviteByEmail(meeting, req.user, emails);
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
};

exports.listMine = async (req, res, next) => {
  try {
    const result = await meetingService.listUserMeetings(req.user._id, {
      status: req.query.status,
      type: req.query.type,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const meeting = await meetingService.getMeetingById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (!meeting.isHostOrCoHost(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only host/co-host can update settings' });
    }
    if (req.body.settings) {
      meeting.settings = { ...meeting.settings.toObject?.() || meeting.settings, ...req.body.settings };
    }
    if (typeof req.body.waitingRoomEnabled === 'boolean') {
      meeting.waitingRoomEnabled = req.body.waitingRoomEnabled;
    }
    if (typeof req.body.locked === 'boolean') {
      meeting.locked = req.body.locked;
    }
    if (req.body.title) meeting.title = req.body.title;
    await meeting.save();
    res.json({ success: true, meeting });
  } catch (err) {
    next(err);
  }
};

exports.transferHost = async (req, res, next) => {
  try {
    const meeting = await meetingService.getMeetingById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (meeting.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only current host can transfer' });
    }
    const newHostId = req.body.userId;
    const participant = meeting.participants.find(
      (p) => p.userId.toString() === newHostId && p.isActive
    );
    if (!participant) {
      return res.status(400).json({ success: false, message: 'User is not an active participant' });
    }
    // Demote old host
    const oldHost = meeting.participants.find(
      (p) => p.userId.toString() === req.user._id.toString()
    );
    if (oldHost) oldHost.role = 'co-host';
    participant.role = 'host';
    meeting.hostId = newHostId;
    if (!meeting.coHosts.some((id) => id.toString() === req.user._id.toString())) {
      meeting.coHosts.push(req.user._id);
    }
    await meeting.save();
    res.json({ success: true, meeting });
  } catch (err) {
    next(err);
  }
};