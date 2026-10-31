const mongoose = require('mongoose');

// All account role/activity mutations share a database lock. Transactions retry
// write conflicts, so two concurrent demotions cannot both observe two admins.
const lockSchema = new mongoose.Schema({ _id: String, version: Number });
const AdminLock = mongoose.model('AdminLock', lockSchema);
module.exports = async function withAdminLock(operation) {
  try {
    await AdminLock.updateOne({ _id: 'user-management' },
      { $setOnInsert: { version: 0 } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return mongoose.connection.transaction(async session => {
    await AdminLock.updateOne({ _id: 'user-management' },
      { $inc: { version: 1 } }, { session });
    return operation(session);
  });
};
