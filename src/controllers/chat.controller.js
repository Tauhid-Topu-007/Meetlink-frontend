const path = require('path');
const Message = require('../models/Message');
const Meeting = require('../models/Meeting');
const { chatDir } = require('../middleware/upload');

/**
 * Upload chat attachment (image or file).
 * Returns URL path that frontend can use.
 */
exports.uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const meetingId = req.body.meetingId;
    if (meetingId) {
      const meeting = await Meeting.findOne({ meetingId: meetingId.toUpperCase() });
      if (!meeting) {
        return res.status(404).json({ success: false, message: 'Meeting not found' });
      }
      if (meeting.settings?.allowChat === false) {
        return res.status(403).json({ success: false, message: 'Chat is disabled' });
      }
    }

    const isImage = req.file.mimetype.startsWith('image/');
    const publicUrl = `/uploads/chat/${req.file.filename}`;

    res.status(201).json({
      success: true,
      attachment: {
        name: req.file.originalname,
        url: publicUrl,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        isImage,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Persist a chat message (optional — real-time still goes via Socket.IO).
 */
exports.saveMessage = async (req, res, next) => {
  try {
    const { meetingId, content, type, attachments, replyTo, mentions } = req.body;
    const meeting = await Meeting.findOne({ meetingId: meetingId?.toUpperCase() });
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const msg = await Message.create({
      meetingId: meeting._id,
      senderId: req.user._id,
      content: content || '',
      type: type || (attachments?.length ? (attachments[0].isImage ? 'image' : 'file') : 'text'),
      attachments: attachments || [],
      replyTo: replyTo || null,
      mentions: mentions || [],
    });

    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    next(err);
  }
};

exports.getMeetingMessages = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId.toUpperCase() });
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    const messages = await Message.find({ meetingId: meeting._id, isDeleted: false })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('senderId', 'displayName avatar')
      .lean();
    res.json({ success: true, messages });
  } catch (err) {
    next(err);
  }
};