const { v4: uuidv4 } = require('uuid');
const Meeting = require('../models/Meeting');

/** Host starts a recording session (metadata). Actual media is client-side or SFU later. */
exports.startRecording = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId.toUpperCase() });
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (!meeting.isHostOrCoHost(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only host/co-host can record' });
    }
    if (!meeting.settings?.recordingEnabled) {
      return res.status(403).json({ success: false, message: 'Recording is disabled for this meeting' });
    }

    const active = (meeting.recordings || []).find((r) => r.status === 'recording');
    if (active) {
      return res.status(400).json({ success: false, message: 'Recording already in progress', recording: active });
    }

    const recording = {
      recordingId: uuidv4(),
      status: 'recording',
      startedBy: req.user._id,
      startedAt: new Date(),
    };
    meeting.recordings.push(recording);
    await meeting.save();

    res.json({ success: true, recording });
  } catch (err) {
    next(err);
  }
};

exports.stopRecording = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId.toUpperCase() });
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (!meeting.isHostOrCoHost(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only host/co-host can stop recording' });
    }

    const rec = (meeting.recordings || []).find((r) => r.status === 'recording');
    if (!rec) {
      return res.status(400).json({ success: false, message: 'No active recording' });
    }

    rec.status = 'ready';
    rec.endedAt = new Date();
    rec.durationSeconds = Math.floor((rec.endedAt - rec.startedAt) / 1000);
    // storageKey can be set when cloud storage is wired
    if (req.body.storageKey) rec.storageKey = req.body.storageKey;
    if (req.body.sizeBytes) rec.sizeBytes = req.body.sizeBytes;

    await meeting.save();
    res.json({ success: true, recording: rec });
  } catch (err) {
    next(err);
  }
};

exports.listRecordings = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId.toUpperCase() })
      .select('meetingId title recordings hostId')
      .lean();
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, recordings: meeting.recordings || [] });
  } catch (err) {
    next(err);
  }
};
