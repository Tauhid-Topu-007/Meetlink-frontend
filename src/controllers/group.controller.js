const Group = require('../models/Group');
const Meeting = require('../models/Meeting');
const meetingService = require('../services/meeting.service');

function normalizeMembers(members) {
  if (!Array.isArray(members)) return [];
  return members
    .map((m) => {
      if (typeof m === 'string') {
        const s = m.trim();
        if (!s) return null;
        if (s.includes('@')) {
          return { name: s.split('@')[0], email: s.toLowerCase(), phone: '' };
        }
        return { name: s, email: '', phone: '' };
      }
      const email = (m.email || '').trim().toLowerCase();
      const name = (m.name || '').trim() || (email ? email.split('@')[0] : 'Member');
      const phone = (m.phone || '').trim();
      if (!name && !email) return null;
      return { name, email, phone, userId: m.userId || null };
    })
    .filter(Boolean);
}

const listMine = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const groups = await Group.find({ ownerId }).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, groups });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, description, members, color } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const normalized = normalizeMembers(members);

    const group = await Group.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      ownerId: req.user._id,
      members: normalized,
      color: color || '#6366f1',
    });

    console.log(`✅ Group created: ${group._id} by ${req.user.email} (${normalized.length} members)`);

    res.status(201).json({
      success: true,
      group: group.toObject ? group.toObject() : group,
    });
  } catch (err) {
    console.error('Group create error:', err.message);
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, ownerId: req.user._id }).lean();
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, group });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const { name, description, members, color } = req.body || {};
    if (name !== undefined) group.name = String(name).trim();
    if (description !== undefined) group.description = description;
    if (members !== undefined) group.members = normalizeMembers(members);
    if (color !== undefined) group.color = color;
    await group.save();
    res.json({ success: true, group });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const group = await Group.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
};

const scheduleMeeting = async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const { title, scheduledStart, scheduledEnd, password, waitingRoomEnabled, description } =
      req.body || {};
    if (!scheduledStart) {
      return res.status(400).json({ success: false, message: 'scheduledStart is required' });
    }

    const start = new Date(scheduledStart);
    if (Number.isNaN(start.getTime()) || start < new Date(Date.now() - 60000)) {
      return res.status(400).json({ success: false, message: 'Pick a valid future date and time' });
    }

    const allowedEmails = (group.members || [])
      .map((m) => (m.email || '').toLowerCase().trim())
      .filter(Boolean);

    const meeting = await meetingService.createMeeting(req.user, {
      title: title?.trim() || `${group.name} Meeting`,
      description: description || group.description || '',
      type: 'scheduled',
      isGroup: true,
      groupName: group.name,
      groupId: group._id,
      allowedEmails,
      scheduledStart: start,
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
      password: password || '',
      waitingRoomEnabled: waitingRoomEnabled !== false,
      settings: { waitingRoomEnabled: waitingRoomEnabled !== false },
    });

    const emails = allowedEmails;
    if (emails.length) {
      try {
        await meetingService.inviteByEmail(meeting, req.user, emails);
      } catch (e) {
        console.warn('Group invite emails partial fail', e.message);
      }
    }

    const populated = await Meeting.findById(meeting._id)
      .populate('hostId', 'displayName email phone')
      .lean();

    res.status(201).json({
      success: true,
      meeting: populated,
      invitedCount: emails.length,
      group: { id: group._id, name: group.name, memberCount: group.members.length },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listMine, create, getOne, update, remove, scheduleMeeting };
