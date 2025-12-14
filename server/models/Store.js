const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
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
      required: true
    }
  },
  address: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  contactNumber: String,
  email: String,
  website: String,
  images: [String],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  subscription: {
    isSubscribed: {
      type: Boolean,
      default: false
    },
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic'
    },
    startDate: Date,
    endDate: Date,
    razorpaySubscriptionId: String,
    razorpayPaymentId: String
  },
  features: {
    hasDelivery: {
      type: Boolean,
      default: false
    },
    hasPickup: {
      type: Boolean,
      default: true
    },
    openingHours: {
      type: Map,
      of: String
    }
  },


qrCode: {
  type: String // QR image ka path / base64 / url
}
,

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

storeSchema.index({ location: '2dsphere' });
storeSchema.index({ name: 'text', description: 'text', category: 'text' });

storeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Store', storeSchema);