const express = require('express');
const router = express.Router();
const Follow = require('../models/followSchema');
const User = require('../models/userSchema');
const Post = require('../models/postSchema');
const Reel = require('../models/reelSchema');
const auth = require('../middleware/auth');

// Get user's profile with stats
router.get('/profile/:userId', async (req, res) => {
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

    // Get post and reel counts
    const postCount = await Post.countDocuments({ user: userId });
    const reelCount = await Reel.countDocuments({ user: userId });

    // Check if requesting user follows this user
    let isFollowing = false;
    if (req.user) {
      const follow = await Follow.findOne({
        follower: req.user.id,
        following: userId
      });
      isFollowing = !!follow;
    }

    res.json({
      success: true,
      user: {
        ...user,
        postCount,
        reelCount,
        isFollowing
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
});

// Get followers list with details and follow status
router.get('/followers/:userId', auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get followers with pagination
    const followers = await Follow.find({ following: userId })
      .populate('follower', 'username name profileImage email followersCount followingCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const totalFollowers = await Follow.countDocuments({ following: userId });

    // Check if current user follows each follower
    const followerIds = followers.map(f => f.follower._id);
    const followStatus = await Follow.find({
      follower: currentUserId,
      following: { $in: followerIds }
    });

    const followStatusMap = {};
    followStatus.forEach(fs => {
      followStatusMap[fs.following.toString()] = true;
    });

    // Enhance followers data with follow status
    const enhancedFollowers = followers.map(follower => ({
      ...follower,
      isFollowing: followStatusMap[follower.follower._id.toString()] || false,
      isOwnProfile: follower.follower._id.toString() === currentUserId
    }));

    res.json({
      success: true,
      data: enhancedFollowers,
      pagination: {
        page,
        limit,
        total: totalFollowers,
        pages: Math.ceil(totalFollowers / limit)
      }
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

// Get following list with details
router.get('/following/:userId', auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get following with pagination
    const following = await Follow.find({ follower: userId })
      .populate('following', 'username name profileImage email followersCount followingCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const totalFollowing = await Follow.countDocuments({ follower: userId });

    // Check if current user follows each following user
    const followingIds = following.map(f => f.following._id);
    const followStatus = await Follow.find({
      follower: currentUserId,
      following: { $in: followingIds }
    });

    const followStatusMap = {};
    followStatus.forEach(fs => {
      followStatusMap[fs.following.toString()] = true;
    });

    // Check if each following user follows back
    const followBackStatus = await Follow.find({
      follower: { $in: followingIds },
      following: currentUserId
    });

    const followBackMap = {};
    followBackStatus.forEach(fs => {
      followBackMap[fs.follower.toString()] = true;
    });

    // Enhance following data
    const enhancedFollowing = following.map(follow => ({
      ...follow,
      isFollowing: followStatusMap[follow.following._id.toString()] || false,
      followsBack: followBackMap[follow.following._id.toString()] || false,
      isOwnProfile: follow.following._id.toString() === currentUserId
    }));

    res.json({
      success: true,
      data: enhancedFollowing,
      pagination: {
        page,
        limit,
        total: totalFollowing,
        pages: Math.ceil(totalFollowing / limit)
      }
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

// Search users (for follow suggestions)
router.get('/search-users', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const searchQuery = req.query.q || '';
    const limit = parseInt(req.query.limit) || 10;

    // Find users matching search query (excluding current user)
    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } },
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
    .limit(limit)
    .lean();

    // Check follow status for each user
    const userIds = users.map(u => u._id);
    const followStatus = await Follow.find({
      follower: currentUserId,
      following: { $in: userIds }
    });

    const followStatusMap = {};
    followStatus.forEach(fs => {
      followStatusMap[fs.following.toString()] = true;
    });

    // Check if users follow back
    const followBackStatus = await Follow.find({
      follower: { $in: userIds },
      following: currentUserId
    });

    const followBackMap = {};
    followBackStatus.forEach(fs => {
      followBackMap[fs.follower.toString()] = true;
    });

    // Enhance users data
    const enhancedUsers = users.map(user => ({
      ...user,
      isFollowing: followStatusMap[user._id.toString()] || false,
      followsBack: followBackMap[user._id.toString()] || false
    }));

    res.json({
      success: true,
      data: enhancedUsers
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

// Get follow suggestions (users not followed)
router.get('/follow-suggestions', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    // Get users that current user follows
    const following = await Follow.find({ follower: currentUserId })
      .select('following');
    
    const followingIds = following.map(f => f.following);
    followingIds.push(currentUserId); // Exclude self

    // Get suggested users (not followed, sorted by followers count)
    const suggestions = await User.find({
      _id: { $nin: followingIds }
    })
    .select('username name profileImage email followersCount followingCount')
    .sort({ followersCount: -1 })
    .limit(limit)
    .lean();

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message
    });
  }
});

// Follow/unfollow user
router.post('/toggle-follow/:userId', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      follower: currentUserId,
      following: targetUserId
    });

    let action = '';
    let follow = null;

    if (existingFollow) {
      // Unfollow
      await existingFollow.deleteOne();
      action = 'unfollowed';
      
      // Update counts
      await User.findByIdAndUpdate(currentUserId, {
        $inc: { followingCount: -1 }
      });
      await User.findByIdAndUpdate(targetUserId, {
        $inc: { followersCount: -1 }
      });
    } else {
      // Follow
      follow = new Follow({
        follower: currentUserId,
        following: targetUserId
      });
      await follow.save();
      action = 'followed';
      
      // Update counts
      await User.findByIdAndUpdate(currentUserId, {
        $inc: { followingCount: 1 }
      });
      await User.findByIdAndUpdate(targetUserId, {
        $inc: { followersCount: 1 }
      });
    }

    // Get updated counts
    const currentUser = await User.findById(currentUserId)
      .select('followingCount');
    const targetUser = await User.findById(targetUserId)
      .select('followersCount');

    res.json({
      success: true,
      action,
      follow,
      counts: {
        currentUserFollowing: currentUser.followingCount,
        targetUserFollowers: targetUser.followersCount
      }
    });

  } catch (error) {
    console.error('Toggle follow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle follow',
      error: error.message
    });
  }
});



router.get('/trending-users', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 7;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    // Get users with most followers, ordered by followers count
    const trendingUsers = await User.find({
      followersCount: { $gt: 0 },
      createdAt: { $gte: daysAgo }
    })
    .select('username name profileImage email followersCount followingCount')
    .sort({ followersCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();

    // Check follow status if authenticated
    if (req.user) {
      const userIds = trendingUsers.map(u => u._id);
      const followStatus = await Follow.find({
        follower: req.user.id,
        following: { $in: userIds }
      });

      const followStatusMap = {};
      followStatus.forEach(fs => {
        followStatusMap[fs.following.toString()] = true;
      });

      trendingUsers.forEach(user => {
        user.isFollowing = followStatusMap[user._id.toString()] || false;
      });
    }

    res.json({
      success: true,
      data: trendingUsers
    });

  } catch (error) {
    console.error('Get trending users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending users',
      error: error.message
    });
  }
});





// Get mutual followers
router.get('/mutual-followers/:userId', auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    // Get users that both follow
    const currentUserFollowing = await Follow.find({ follower: currentUserId })
      .select('following');
    const targetUserFollowing = await Follow.find({ follower: userId })
      .select('following');

    const currentFollowingIds = currentUserFollowing.map(f => f.following.toString());
    const targetFollowingIds = targetUserFollowing.map(f => f.following.toString());

    // Find intersection (mutual following)
    const mutualIds = currentFollowingIds.filter(id => 
      targetFollowingIds.includes(id) && id !== currentUserId && id !== userId
    );

    // Get mutual users details
    const mutualUsers = await User.find({ _id: { $in: mutualIds } })
      .select('username name profileImage')
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: mutualUsers,
      count: mutualIds.length
    });

  } catch (error) {
    console.error('Get mutual followers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mutual followers',
      error: error.message
    });
  }
});

module.exports = router;