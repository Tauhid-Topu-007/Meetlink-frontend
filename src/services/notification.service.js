const Notification = require('../models/Notification');

const create = async (payload) => {
  return Notification.create(payload);
};

const listForUser = async (userId, { page = 1, limit = 30, unreadOnly = false } = {}) => {
  const query = { userId };
  if (unreadOnly) query.isRead = false;

  const skip = (page - 1) * limit;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    notifications: items,
    unreadCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

const markRead = async (userId, notificationIds = []) => {
  const filter = { userId };
  if (notificationIds.length) filter._id = { $in: notificationIds };
  await Notification.updateMany(filter, { isRead: true, readAt: new Date() });
};

const markAllRead = async (userId) => {
  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

module.exports = {
  create,
  listForUser,
  markRead,
  markAllRead,
};