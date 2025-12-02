const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  address: String,
  image: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

storeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Store', storeSchema);