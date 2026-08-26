const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const register = async ({ username, email, password, displayName, phone }) => {
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    const err = new Error(existing.email === email ? 'Email already registered' : 'Username taken');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.create({
    username,
    email,
    password,
    displayName: displayName || username,
    phone: phone || '',
    isVerified: true,
  });

  const token = signToken(user);
  return { user: user.toPublicJSON(), token };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password +tokenVersion');
  if (!user || !(await user.comparePassword(password))) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }
  if (!user.isActive) {
    const err = new Error('Account is deactivated');
    err.statusCode = 403;
    throw err;
  }

  user.lastLogin = new Date();
  user.lastSeen = new Date();
  user.onlineStatus = 'online';
  await user.save();

  const token = signToken(user);
  return { user: user.toPublicJSON(), token };
};

const logoutAllDevices = async (userId) => {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
};

module.exports = {
  signToken,
  register,
  login,
  logoutAllDevices,
};