const { body, validationResult } = require('express-validator');

// Validation rules for store creation
const validateStore = [
  body('name')
    .notEmpty().withMessage('Store name is required')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Store name must be between 2 and 100 characters'),
  
  body('description')
    .notEmpty().withMessage('Description is required')
    .trim()
    .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  
  body('address')
    .notEmpty().withMessage('Address is required')
    .trim()
    .isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),
  
  body('category')
    .notEmpty().withMessage('Category is required')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Category must be between 2 and 50 characters'),
  
  body('latitude')
    .notEmpty().withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  
  body('longitude')
    .notEmpty().withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  
  body('contactNumber')
    .optional()
    .matches(/^[0-9]{10}$/).withMessage('Valid 10-digit phone number required'),
  
  body('email')
    .optional()
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),
  
  body('website')
    .optional()
    .isURL().withMessage('Valid URL required')
];

// Validation rules for product creation
const validateProduct = [
  body('name')
    .notEmpty().withMessage('Product name is required')
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage('Product name must be between 2 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must not exceed 2000 characters'),
  
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
  
  body('category')
    .notEmpty().withMessage('Category is required')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Category must be between 2 and 50 characters'),
  
  body('stock')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock must be 0 or greater'),
  
  body('discount')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100'),
  
  body('store')
    .notEmpty().withMessage('Store ID is required')
    .isMongoId().withMessage('Valid store ID required')
];

// Validation rules for user profile
const validateUserProfile = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  body('mobile')
    .optional()
    .matches(/^[0-9]{10}$/).withMessage('Valid 10-digit phone number required'),
  
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscores')
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

module.exports = {
  validateStore,
  validateProduct,
  validateUserProfile,
  handleValidationErrors
};