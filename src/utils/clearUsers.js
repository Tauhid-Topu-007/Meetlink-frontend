/**
 * Dev helper: clear all users from the database.
 * Usage: node src/utils/clearUsers.js
 * Only runs when NODE_ENV !== 'production'
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to clear users in production');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meetlink';
  await mongoose.connect(uri);
  console.log('Connected to', uri);

  const User = require('../models/User');
  const result = await User.deleteMany({});
  console.log(`Deleted ${result.deletedCount} user(s).`);

  await mongoose.disconnect();
  console.log('Done. You can register a new account now.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
