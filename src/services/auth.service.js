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

const normalizeEmail = (email) => (email || '').toString().trim().toLowerCase();
const normalizeUsername = (username) => (username || '').toString().trim().toLowerCase();

const register = async ({ username, email, password, displayName, phone }) => {
  const cleanEmail = normalizeEmail(email);
  const cleanUsername = normalizeUsername(username);

  if (!cleanEmail || !cleanUsername) {
    const err = new Error('Email and username are required');
    err.statusCode = 400;
    throw err;
  }
  if (!password || password.length < 6) {
    const err = new Error('Password must be at least 6 characters');
    err.statusCode = 400;
    throw err;
  }
  if (cleanUsername.length < 3) {
    const err = new Error('Username must be at least 3 characters');
    err.statusCode = 400;
    throw err;
  }

  // Check both fields with normalized values (schema also lowercases on save)
  const existingEmail = await User.findOne({ email: cleanEmail });
  if (existingEmail) {
    const err = new Error('Email already registered. Try signing in or use a different email.');
    err.statusCode = 400;
    throw err;
  }

  const existingUsername = await User.findOne({ username: cleanUsername });
  if (existingUsername) {
    const err = new Error('Username already taken. Please choose another.');
    err.statusCode = 400;
    throw err;
  }

  try {
    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password,
      displayName: (displayName || username || cleanUsername).toString().trim(),
      phone: (phone || '').toString().trim(),
      isVerified: true,
    });

    const token = signToken(user);
    return { user: user.toPublicJSON(), token };
  } catch (err) {
    // Race condition or leftover unique index
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      const msg =
        field === 'email'
          ? 'Email already registered. Try signing in or use a different email.'
          : field === 'username'
            ? 'Username already taken. Please choose another.'
            : `${field} already exists`;
      const e = new Error(msg);
      e.statusCode = 400;
      throw e;
    }
    throw err;
  }
};

const login = async ({ email, password }) => {
  const cleanEmail = normalizeEmail(email);
  const user = await User.findOne({ email: cleanEmail }).select('+password +tokenVersion');
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
