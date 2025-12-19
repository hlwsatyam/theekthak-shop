const Reel = require('../models/reelSchema');
const Like = require('../models/Like');
const User = require('../models/User');
const { default: mongoose } = require('mongoose');
const followSchema = require('../models/followSchema');

 exports.getReelsFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Cache key for this user's feed
    const cacheKey = `reels_feed_${req.user._id}_${page}`;
    
    // Try to get from cache first (if using Redis)
    // const cached = await redisClient.get(cacheKey);
    // if (cached) {
    //   return res.json(JSON.parse(cached));
    // }

    // Get reels with optimized query
    const reels = await Reel.aggregate([
      {
        $match: {
          $or: [
            { visibility: 'public' },
            { user: req.user._id }
          ]
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                username: 1,
                name: 1,
                profileImage: 1,
                followersCount: 1,
                followingCount: 1
              }
            }
          ]
        }
      },
      { $unwind: '$user' }
    ]);

    // Check likes in a single query for all reels
    const reelIds = reels.map(reel => reel._id);
    const likes = await Like.find({
      user: req.user._id,
      targetId: { $in: reelIds },
      targetType: 'Reel'
    }).lean();

    // Create a map of liked reel IDs
    const likedReelIds = new Set(likes.map(like => like.targetId.toString()));

    // Add isLiked property to each reel
    const reelsWithLikes = reels.map(reel => ({
      ...reel,
      isLiked: likedReelIds.has(reel._id.toString())
    }));

    const total = await Reel.countDocuments({
      $or: [
        { visibility: 'public' },
        { user: req.user._id }
      ]
    });

    const response = {
      success: true,
      reels: reelsWithLikes,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    };

    // Cache the response (Redis example)
    // await redisClient.setex(cacheKey, 60, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    console.error('Error fetching reels:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.likeReel = async (req, res) => {
  try {
    const { reelId } = req.params;
    const userId = req.user._id;

 

    try {
      const reel = await Reel.findById(reelId) 
      if (!reel) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: 'Reel not found' });
      }

      const existingLike = await Like.findOne({
        user: userId,
        targetId: reelId,
        targetType: 'Reel'
      }) 

      if (existingLike) {
        // Unlike
        await existingLike.deleteOne({   });
        reel.likesCount = Math.max(0, reel.likesCount - 1);
        await reel.save({   });
  
        
        return res.json({
          success: true,
          message: 'Reel unliked',
          isLiked: false,
          likesCount: reel.likesCount
        });
      } else {
        // Like
        const like = new Like({
          user: userId,
          targetId: reelId,
          targetType: 'Reel'
        });
        await like.save({   });
        reel.likesCount += 1;
        await reel.save({   });
        
     
        
        return res.json({
          success: true,
          message: 'Reel liked',
          isLiked: true,
          likesCount: reel.likesCount
        });
      }
    } catch (error) {
   
      throw error;
    }  
  } catch (error) {
    console.error('Error liking reel:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.incrementViews = async (req, res) => {
  try {
    const { reelId } = req.params;
    
    await Reel.findByIdAndUpdate(reelId, { $inc: { viewsCount: 1 } });
    
    res.json({ success: true, message: 'View counted' });
  } catch (error) {
    console.error('Error incrementing view:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === currentUserId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    // Check if already following
    const existingFollow = await followSchema.findOne({
      follower: currentUserId,
      following: userId
    });

    if (existingFollow) {
      // Unfollow
      await existingFollow.deleteOne();
      
      // Update counts
      await User.findByIdAndUpdate(currentUserId, { $inc: { followingCount: -1 } });
      await User.findByIdAndUpdate(userId, { $inc: { followersCount: -1 } });

   return   res.json({
        success: true,
        message: 'Unfollowed successfully',
        isFollowing: false,
        followersCount: await User.findById(userId).select('followersCount')
      });
    } else {
      // Follow
      const follow = new followSchema({
        follower: currentUserId,
        following: userId
      });
      await follow.save();
      
      // Update counts
      await User.findByIdAndUpdate(currentUserId, { $inc: { followingCount: 1 } });
      await User.findByIdAndUpdate(userId, { $inc: { followersCount: 1 } });

    return  res.json({
        success: true,
        message: 'Followed successfully',
        isFollowing: true,
        followersCount: await User.findById(userId).select('followersCount')
      });
    }
  } catch (error) {
    console.error('Error following user:', error);
   return res.status(500).json({ success: false, message: 'Server error' });
  }
};
exports.getReelById = async (req, res) => {
  try {
    const { reelId } = req.params;
    
    const reel = await Reel.findById(reelId)
      .populate('user', 'username name profileImage followersCount followingCount');
    
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const isLiked = await Like.findOne({
      user: req.user._id,
      targetId: reelId,
      targetType: 'Reel'
    });

    res.json({
      success: true,
      reel: {
        ...reel.toObject(),
        isLiked: !!isLiked
      }
    });
  } catch (error) {
    console.error('Error fetching reel:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};