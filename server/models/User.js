const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  mobile: String,
  username: {
    type: String,
    unique: true,
    sparse: true
  },
  name: String,
  otp: String,
  otpExpires: Date,
  isVerified: {
    type: Boolean,
    default: false
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'store_owner', 'admin'],
    default: 'user'
  },
  profileImage: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);