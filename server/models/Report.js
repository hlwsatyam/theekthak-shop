// backend/models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedReelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reel',
    required: true
  },
  reason: {
    type: String,
    enum: ['spam', 'inappropriate', 'violence', 'hate_speech', 'harassment', 'copyright', 'other'],
    required: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Report', reportSchema);