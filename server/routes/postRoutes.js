const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Post = require('../models/postSchema');
const { auth, optionalAuth } = require('../middleware/authx.js');
const Like = require('../models/Like.js');

// Configure multer for post uploads (images only)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/posts/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for posts'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max for images
  }
});

// Create a new post
router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    const { caption, description, tags, visibility } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }

    const post = new Post({
      user: userId,
      mediaUrl: `/uploads/posts/${req.file.filename}`,
      mediaType: 'image',
      caption,
      description,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      visibility: visibility || 'public'
    });

    await post.save();

    // Populate user details
    await post.populate('user', 'username name profileImage');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: post
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post',
      error: error.message
    });
  }
});

// Get all posts (with pagination and filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query based on visibility and user
    let query = { visibility: 'public' };

    // If user is authenticated, show their private posts too
    if (req.user) {
      query = {
        $or: [
          { visibility: 'public' },
          { user: req.user.id },
          { 
            visibility: 'followers_only',
            user: { $in: await getFollowingUsers(req.user.id) }
          }
        ]
      };
    }

    // Filter by user if specified
    if (req.query.userId) {
      query.user = req.query.userId;
    }

    // Filter by tags if specified
    if (req.query.tags) {
      const tagsArray = req.query.tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagsArray };
    }

    // Get posts with pagination
    const posts = await Post.find(query)
      .populate('user', 'username name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Check if current user liked each post
    if (req.user) {
      // This would require a Like model - implementing basic version
      posts.forEach(post => {
        post.isLiked = false; // You'll need to implement likes logic
        post.isBookmarked = false; // You'll need to implement bookmarks logic
      });
    }

    // Get total count
    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get posts',
      error: error.message
    });
  }
});

// Get a single post
router.get('/:postId', optionalAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('user', 'username name profileImage followersCount followingCount')
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check visibility
    if (post.visibility === 'private' && 
        (!req.user || post.user._id.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'This post is private'
      });
    }

    // Check followers_only visibility
    if (post.visibility === 'followers_only' && req.user) {
      const isFollowing = await checkIfFollowing(req.user.id, post.user._id);
      if (!isFollowing && post.user._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'This post is only visible to followers'
        });
      }
    }

 

    res.json({
      success: true,
      data: {
        ...post 
      }
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get post',
      error: error.message
    });
  }
});

// Update a post
router.put('/:postId', auth, async (req, res) => {
  try {
    const { caption, description, tags, visibility } = req.body;
    const postId = req.params.postId;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check ownership
    if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post'
      });
    }

    // Update fields
    if (caption !== undefined) post.caption = caption;
    if (description !== undefined) post.description = description;
    if (tags !== undefined) post.tags = tags.split(',').map(tag => tag.trim());
    if (visibility !== undefined) post.visibility = visibility;

    await post.save();

    res.json({
      success: true,
      message: 'Post updated successfully',
      data: post
    });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update post',
      error: error.message
    });
  }
});

// Delete a post
router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check ownership
    if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    // Delete the image file
    if (post.mediaUrl) {
      const filePath = path.join(__dirname, '..', post.mediaUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await post.deleteOne();

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete post',
      error: error.message
    });
  }
});

// Get user's posts
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
  
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query based on visibility
    let query = { user: userId };

    // If viewing own profile or admin
    if (req.user && (req.user.id === userId  )) {
      // Show all posts
    } else if (req.user) {
      // Show public posts and followers_only if following
      const isFollowing = await checkIfFollowing(req.user.id, userId);
      query = {
        user: userId,
        $or: [
          { visibility: 'public' },
          { 
            visibility: 'followers_only',
            $expr: { $eq: [isFollowing, true] }
          }
        ]
      };
    } else {
      // Anonymous user - only public posts
      query = {
        user: userId,
        visibility: 'public'
      };
    }

    const posts = await Post.find(query)
      .populate('user', 'username name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Post.countDocuments(query);
 
    res.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user posts',
      error: error.message
    });
  }
});

 


router.post('/:postId/like', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const alreadyLiked = await Like.findOne({
      user: userId,
      targetId: postId,
      targetType: 'Post'
    });

    if (alreadyLiked) {
      return res.status(400).json({ message: 'Already liked' });
    }

    await Like.create({
      user: userId,
      targetId: postId,
      targetType: 'Post'
    });

    await Post.findByIdAndUpdate(postId, {
      $inc: { likesCount: 1 }
    });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post('/:postId/unlike', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const deleted = await Like.findOneAndDelete({
      user: userId,
      targetId: postId,
      targetType: 'Post'
    });

    if (!deleted) {
      return res.status(400).json({ message: 'Not liked yet' });
    }

    await Post.findByIdAndUpdate(postId, {
      $inc: { likesCount: -1 }
    });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

 
// Get post analytics (for post owner)
router.get('/:postId/analytics', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check ownership
    if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics'
      });
    }

    // Basic analytics
    const analytics = {
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      viewsCount: 0, // You'll need to implement views
      sharesCount: 0, // You'll need to implement shares
      engagementRate: calculateEngagementRate(post),
      createdAt: post.createdAt,
      lastUpdated: post.updatedAt
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
      error: error.message
    });
  }
});

// Helper functions
async function getFollowingUsers(userId) {
  const Follow = require('../models/followSchema');
  const follows = await Follow.find({ follower: userId }).select('following');
  return follows.map(f => f.following);
}

async function checkIfFollowing(followerId, followingId) {
  const Follow = require('../models/followSchema');
  const follow = await Follow.findOne({
    follower: followerId,
    following: followingId
  });
  return !!follow;
}

function calculateEngagementRate(post) {
  // Simple engagement rate calculation
  // In production, you'd have more metrics
  const totalEngagement = post.likesCount + post.commentsCount;
  return totalEngagement > 0 ? totalEngagement : 0;
}

module.exports = router;