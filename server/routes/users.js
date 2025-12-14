const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Store = require('../models/Store');
const { authMiddleware } = require('../middleware/auth');
const { validateUserProfile, handleValidationErrors } = require('../middleware/validation');
const { upload, handleMulterError } = require('../middleware/upload');

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -otp -otpExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user profile
router.put('/profile', 
  authMiddleware,
  upload.single('profileImage'),
  validateUserProfile,
  handleValidationErrors,
  handleMulterError,
  async (req, res) => {
    try {
      const updates = req.body;
      
      // Handle profile image upload
      if (req.file) {
        updates.profileImage = req.file.filename;
      }

      // Update user
      const user = await User.findByIdAndUpdate(
        req.user.id,
        updates,
        { new: true, runValidators: true }
      ).select('-password -otp -otpExpires');

      // Update profileCompleted status if name is set
      if (!user.profileCompleted && user.name) {
        user.profileCompleted = true;
        await user.save();
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// Get user's stores
router.get('/my-stores', authMiddleware, async (req, res) => {
  try {
    const stores = await Store.find({ owner: req.user.id })
      .populate('owner', 'name email username profileImage')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: stores.length,
      stores
    });
  } catch (error) {
    console.error('Get user stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user's subscriptions
router.get('/subscriptions', authMiddleware, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user.id })
      .populate('store', 'name category images')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: subscriptions.length,
      subscriptions
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete user account
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    // Check if user has stores
    const stores = await Store.find({ owner: req.user.id });
    
    if (stores.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please delete your stores before deleting account'
      });
    }

    // Delete user
    await User.findByIdAndDelete(req.user.id);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;