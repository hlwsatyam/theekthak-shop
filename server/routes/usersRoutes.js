const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Follow = require('../models/followSchema');
const Post = require('../models/postSchema');
const Reel = require('../models/reelSchema');
const {authMiddleware:  auth} = require('../middleware/auth');

// Get user profile with detailed stats
router.get('/:userId', auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await User.findById(userId)
      .select('-password -otp -otpExpires')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get detailed counts
    const postCount = await Post.countDocuments({ user: userId });
    const reelCount = await Reel.countDocuments({ user: userId });
    
    // Check follow status
    const isFollowing = await Follow.findOne({
      follower: req.user.id,
      following: userId
    });

    // Check if follows back
    const followsBack = await Follow.findOne({
      follower: userId,
      following: req.user.id
    });

    // Get mutual followers count
    const currentUserFollowing = await Follow.find({ follower: req.user.id })
      .select('following');
    const targetUserFollowing = await Follow.find({ follower: userId })
      .select('following');

    const currentFollowingIds = currentUserFollowing.map(f => f.following.toString());
    const targetFollowingIds = targetUserFollowing.map(f => f.following.toString());

    const mutualIds = currentFollowingIds.filter(id => 
      targetFollowingIds.includes(id) && id !== req.user.id && id !== userId
    );

    res.json({
      success: true,
      user: {
        ...user,
        postCount,
        reelCount,
        isFollowing: !!isFollowing,
        followsBack: !!followsBack,
        mutualFollowersCount: mutualIds.length
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
      error: error.message
    });
  }
});

// Update user profile
router.put('/update-profile', auth, async (req, res) => {
  try {
    const { username, name, bio, profileImage } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (username) updateData.username = username;
    if (name) updateData.name = name;
    if (bio) updateData.bio = bio;
    if (profileImage) updateData.profileImage = profileImage;

    // If username is being updated, check uniqueness
    if (username) {
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, select: '-password -otp -otpExpires' }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Search users globally
router.get('/search', auth, async (req, res) => {
  try {
    const searchQuery = req.query.q || '';
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    if (searchQuery.length < 2) {
      return res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, pages: 0 }
      });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user.id } },
        {
          $or: [
            { username: { $regex: searchQuery, $options: 'i' } },
            { name: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    })
    .select('username name profileImage email followersCount followingCount')
    .skip(skip)
    .limit(limit)
    .lean();

    const total = await User.countDocuments({
      $and: [
        { _id: { $ne: req.user.id } },
        {
          $or: [
            { username: { $regex: searchQuery, $options: 'i' } },
            { name: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    });

    // Check follow status
    const userIds = users.map(u => u._id);
    const followStatus = await Follow.find({
      follower: req.user.id,
      following: { $in: userIds }
    });

    const followStatusMap = {};
    followStatus.forEach(fs => {
      followStatusMap[fs.following.toString()] = true;
    });

    users.forEach(user => {
      user.isFollowing = followStatusMap[user._id.toString()] || false;
    });

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
});

// Get mutual connections between two users
router.get('/mutual/:userId', auth, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    // Get users that both follow
    const currentUserFollowing = await Follow.find({ follower: req.user.id })
      .populate('following', 'username name profileImage')
      .lean();
    
    const otherUserFollowing = await Follow.find({ follower: otherUserId })
      .populate('following', 'username name profileImage')
      .lean();

    const currentFollowingIds = currentUserFollowing.map(f => f.following._id.toString());
    const otherFollowingIds = otherUserFollowing.map(f => f.following._id.toString());

    const mutualIds = currentFollowingIds.filter(id => 
      otherFollowingIds.includes(id) && id !== req.user.id && id !== otherUserId
    );

    // Get mutual users details
    const mutualUsers = currentUserFollowing
      .filter(f => mutualIds.includes(f.following._id.toString()))
      .map(f => ({
        _id: f.following._id,
        username: f.following.username,
        name: f.following.name,
        profileImage: f.following.profileImage,
        followedAt: f.createdAt
      }))
      .sort((a, b) => new Date(b.followedAt) - new Date(a.followedAt))
      .slice(0, 10);

    res.json({
      success: true,
      data: mutualUsers,
      count: mutualIds.length
    });

  } catch (error) {
    console.error('Get mutual connections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mutual connections',
      error: error.message
    });
  }
});

// Get user's posts and reels
router.get('/:userId/content', auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Get user's posts
    const posts = await Post.find({ user: userId })
      .populate('user', 'username name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get user's reels
    const reels = await Reel.find({ user: userId })
      .populate('user', 'username name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Combine and sort by date
    const allContent = [...posts, ...reels].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      success: true,
      data: allContent.slice(0, limit)
    });

  } catch (error) {
    console.error('Get user content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user content',
      error: error.message
    });
  }
});

module.exports = router;