const mongoose = require('mongoose');

const scanHistorySchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scannedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ScanHistory', scanHistorySchema);
