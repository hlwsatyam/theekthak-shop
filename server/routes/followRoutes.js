const express = require('express');
const router = express.Router();
const Follow = require('../models/followSchema');
const User = require('../models/User');
const {authMiddleware:  auth} = require('../middleware/auth');

// Follow a user
router.post('/follow/:userId', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const followerId = req.user.id;

    if (targetUserId === followerId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      follower: followerId,
      following: targetUserId
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    // Create follow
    const follow = new Follow({
      follower: followerId,
      following: targetUserId
    });

    await follow.save();

    // Update follower's following count
    await User.findByIdAndUpdate(followerId, {
      $inc: { followingCount: 1 }
    });

    // Update target user's followers count
    await User.findByIdAndUpdate(targetUserId, {
      $inc: { followersCount: 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Successfully followed user'
    });

  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to follow user',
      error: error.message
    });
  }
});

// Unfollow a user
router.post('/unfollow/:userId', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const followerId = req.user.id;

    const follow = await Follow.findOneAndDelete({
      follower: followerId,
      following: targetUserId
    });

    if (!follow) {
      return res.status(404).json({
        success: false,
        message: 'Not following this user'
      });
    }

    // Update follower's following count
    await User.findByIdAndUpdate(followerId, {
      $inc: { followingCount: -1 }
    });

    // Update target user's followers count
    await User.findByIdAndUpdate(targetUserId, {
      $inc: { followersCount: -1 }
    });

    res.json({
      success: true,
      message: 'Successfully unfollowed user'
    });

  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unfollow user',
      error: error.message
    });
  }
});

// Get followers list
router.get('/followers/:userId', async (req, res) => {
  try {
    const followers = await Follow.find({ following: req.params.userId })
      .populate('follower', 'username name profileImage')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: followers
    });

  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get followers',
      error: error.message
    });
  }
});

// Get following list
router.get('/following/:userId', async (req, res) => {
  try {
    const following = await Follow.find({ follower: req.params.userId })
      .populate('following', 'username name profileImage')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: following
    });

  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get following',
      error: error.message
    });
  }
});

// Check if following
router.get('/is-following/:userId', auth, async (req, res) => {
  try {
    const isFollowing = await Follow.findOne({
      follower: req.user.id,
      following: req.params.userId
    });

    res.json({
      success: true,
      isFollowing: !!isFollowing
    });

  } catch (error) {
    console.error('Check following error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check follow status',
      error: error.message
    });
  }
});

module.exports = router;