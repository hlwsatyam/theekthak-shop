const rateLimit = require('express-rate-limit');

// Rate limiter for OTP requests
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OTP requests per windowMs
  message: {
    success: false,
    message: 'Too many OTP requests, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for store creation
const storeCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 store creations per hour
  message: {
    success: false,
    message: 'Too many store creation attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for product creation
const productCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 product creations per hour
  message: {
    success: false,
    message: 'Too many product creation attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for API requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  otpLimiter,
  storeCreationLimiter,
  productCreationLimiter,
  apiLimiter
};