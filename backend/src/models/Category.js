const mongoose = require('mongoose');

module.exports = mongoose.model('Category', new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  active: { type: Boolean, default: true },
}));
