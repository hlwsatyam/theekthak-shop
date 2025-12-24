const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const { authMiddleware } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Multer configuration for store images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/stores/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Create Store
router.post('/', 
  authMiddleware,
  upload.array('images', 5),
  [
    body('name').notEmpty().withMessage('Store name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('latitude').isNumeric().withMessage('Valid latitude is required'),
    body('longitude').isNumeric().withMessage('Valid longitude is required'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { 
        name, 
        description, 
        address, 
        category,
        contactNumber,
        assContactNumber,
        email,
        website,
        latitude,
        longitude 
      } = req.body;
 
      // Check if user already has a store
      const existingStore = await Store.findOne({ owner: req.user.id });
      if (existingStore) {
        return res.status(400).json({
          success: false,
          message: 'You already have a store'
        });
      }
      if (!longitude  || !latitude  ) {
        return res.status(400).json({
          success: false,
          message: 'You need to share ur store location by enabling your geo location!'
        });
      }

      // Check if store name is taken
      const storeExists = await Store.findOne({ name });
      if (storeExists) {
        return res.status(409).json({
          success: false,
          message: 'Store name already taken'
        });
      }

      const images = req.files ? req.files.map(file => file.filename) : [];
 
    if (!images  || !images?.length>0      ) {
        return res.status(410).json({
          success: false,
          message: 'Need a atleast 2 pic of store'
        });
      }
 

      const store = new Store({
        name,
        description,
        address,
        category,
        owner: req.user.id,
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        contactNumber,assContactNumber,
        email,
        website,
        images,
        features: {
          hasDelivery: req.body.hasDelivery === 'true',
          hasPickup: req.body.hasPickup === 'true',
          openingHours: req.body.openingHours ? JSON.parse(req.body.openingHours) : {}
        }
      });

      await store.save();


const qrPayload = `www.theekthak.techmintlab.com/store/scan/${store._id}`;

const qrCodeBase64 = await QRCode.toDataURL(qrPayload);

// update store with qr
store.qrCode = qrCodeBase64;
await store.save();


 


      // Update user role to store owner
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user.id, { role: 'store_owner' });

      res.status(201).json({
        success: true,
        message: 'Store created successfully',
        store
      });
    } catch (error) {
      console.error('Create Store Error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  }
);

// Get Nearby Stores
// router.get('/nearby', async (req, res) => {
//   try {
//     const { latitude, longitude, maxDistance = 10000, category } = req.query;

//     if (!latitude || !longitude) {
//       return res.status(400).json({
//         success: false,
//         message: 'Latitude and longitude are required'
//       });
//     }

//     const query = {
//       location: {
//         $near: {
//           $geometry: {
//             type: "Point",
//             coordinates: [parseFloat(longitude), parseFloat(latitude)]
//           },
//           $maxDistance: parseFloat(maxDistance)
//         }
//       },
//       isActive: true
//     };

//     if (category) {
//       query.category = category;
//     }

//     const stores = await Store.find(query)
//       .populate('owner', 'name email username')
//       .limit(20);

//     res.json({
//       success: true,
//       count: stores.length,
//       stores
//     });
//   } catch (error) {
//     console.error('Nearby Stores Error:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Server error', 
//       error: error.message 
//     });
//   }
// });

// // Search Stores
// router.get('/search', async (req, res) => {
//   try {
//     const { q, category, minRating, hasDelivery, page = 1, limit = 10 } = req.query;

//     const query = { isActive: true };

//     if (q) {
//       query.$text = { $search: q };
//     }

//     if (category) {
//       query.category = category;
//     }

//     if (minRating) {
//       query.rating = { $gte: parseFloat(minRating) };
//     }

//     if (hasDelivery === 'true') {
//       query['features.hasDelivery'] = true;
//     }

//     const skip = (page - 1) * limit;

//     const stores = await Store.find(query)
//       .populate('owner', 'name email username')
//       .skip(skip)
//       .limit(parseInt(limit))
//       .sort({ rating: -1, createdAt: -1 });

//     const total = await Store.countDocuments(query);

//     res.json({
//       success: true,
//       total,
//       page: parseInt(page),
//       pages: Math.ceil(total / limit),
//       stores
//     });
//   } catch (error) {
//     console.error('Search Stores Error:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Server error', 
//       error: error.message 
//     });
//   }
// });









router.post('/submit/rating/store/:id/rate', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, rating, comment } = req.body;

    // Validation
    if (!userId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'User ID and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check if user already reviewed this store
    const existingReviewIndex = store.reviews.findIndex(
      review => review.user.toString() === userId
    );

    const oldRating = existingReviewIndex !== -1 ? store.reviews[existingReviewIndex].rating : null;
    const totalRatings = store.reviews.length;

    if (existingReviewIndex !== -1) {
      // Update existing review
      store.reviews[existingReviewIndex].rating = rating;
      store.reviews[existingReviewIndex].comment = comment || store.reviews[existingReviewIndex].comment;
      store.reviews[existingReviewIndex].createdAt = new Date();
    } else {
      // Add new review
      store.reviews.push({
        user: userId,
        rating,
        comment: comment || '',
        createdAt: new Date()
      });
    }

    // Calculate new average rating
    let newRatingTotal;
    if (oldRating !== null) {
      // If updating existing review
      newRatingTotal = (store.rating * totalRatings) - oldRating + rating;
      store.rating = newRatingTotal / totalRatings;
    } else {
      // If adding new review
      newRatingTotal = (store.rating * totalRatings) + rating;
      store.rating = newRatingTotal / (totalRatings + 1);
      store.ratingCount = totalRatings + 1;
    }

    await store.save();

    res.json({
      success: true,
      message: existingReviewIndex !== -1 ? 'Review updated successfully' : 'Review added successfully',
      store: {
        _id: store._id,
        rating: store.rating,
        ratingCount: store.ratingCount,
        reviews: store.reviews
      }
    });

  } catch (error) {
    console.error('Rating Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});












// Get Nearby Stores with Pagination using $geoNear
router.get('/nearby', async (req, res) => {
  try {
    const { 
      latitude, 
      longitude, 
      maxDistance = 500000, // Default 50km
      category,
      page = 1, 
      limit = 10 
    } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // 1. Build the $geoNear stage
    const geoNearStage = {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)] // Note: longitude first
        },
        distanceField: 'distance', // Field name to store calculated distance in meters
        maxDistance: parseFloat(maxDistance),
        spherical: true, // Use spherical geometry for accurate Earth calculations
        query: { isActive: true } // Base filter
      }
    };

    // 2. Add category filter if needed
    if (category && category !== 'all') {
      geoNearStage.$geoNear.query.category = category;
    }

    // 3. Build the aggregation pipeline
    const pipeline = [geoNearStage];
    
    // 4. Add pagination stages
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    // 5. Execute the aggregation
    const stores = await Store.aggregate(pipeline);

    // To get total count for pagination info, you would need a separate count query
    // using $geoWithin (Method 2 below)

    res.json({
      success: true,
      page: parseInt(page),
      stores // Now each store has a 'distance' field in meters
    });

  } catch (error) {
    console.error('Nearby Stores Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});
// Get Popular Stores with Pagination
router.get('/popular', async (req, res) => {
  try {
    const { 
      category,
      page = 1, 
      limit = 10 
    } = req.query;

    const query = { 
      isActive: true,
     
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const stores = await Store.find(query)
      .populate('owner', 'name email username')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ 
     
        createdAt: -1 
      });

    const total = await Store.countDocuments(query);
    
    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      stores
    });
  } catch (error) {
    console.error('Popular Stores Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Search Stores with Pagination
router.get('/search', async (req, res) => {
  try {
    const { 
      q, 
      category, 
      minRating, 
      hasDelivery, 
      sortBy = 'relevance',
      page = 1, 
      limit = 10 
    } = req.query;

    const query = { isActive: true };

    // Text search
    if (q && q.trim().length > 0) {
      query.$text = { $search: q.trim() };
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Rating filter
    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    // Delivery filter
    if (hasDelivery === 'true') {
      query['features.hasDelivery'] = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    let sort = {};
    switch(sortBy) {
      case 'rating':
        sort = { rating: -1, ratingCount: -1 };
        break;
      case 'distance':
        // This would require location coordinates
        sort = { createdAt: -1 };
        break;
      case 'newest':
        sort = { createdAt: -1 };
        break;
      default: // relevance
        if (q && q.trim().length > 0) {
          sort = { score: { $meta: "textScore" } };
        } else {
          sort = { rating: -1, createdAt: -1 };
        }
    }

    let storesQuery = Store.find(query)
      .populate('owner', 'name email username')
      .skip(skip)
      .limit(parseInt(limit));

    // Add text score for relevance sorting
    if (q && q.trim().length > 0 && sortBy === 'relevance') {
      storesQuery = storesQuery.select({ score: { $meta: "textScore" } });
    }

    storesQuery = storesQuery.sort(sort);

    const stores = await storesQuery.exec();
    const total = await Store.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      stores
    });
  } catch (error) {
    console.error('Search Stores Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get Categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Store.distinct('category');
    
    // You can customize category icons here
    const categoryIcons = {
      'grocery': 'shopping-cart',
      'electronics': 'devices',
      'clothing': 'checkroom',
      'restaurant': 'restaurant',
      'pharmacy': 'local-pharmacy',
      'beauty': 'spa',
      'home': 'home',
      // Add more as needed
    };

    const formattedCategories = categories
      .filter(cat => cat) // Remove null/undefined
      .map(cat => ({
        id: cat.toLowerCase(),
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        icon: categoryIcons[cat.toLowerCase()] || 'store'
      }));

    res.json({
      success: true,
      categories: formattedCategories
    });
  } catch (error) {
    console.error('Categories Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});























// Get Store by ID
router.get('/:id', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id)
      .populate('owner', 'name email username profileImage')
  
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    res.json({
      success: true,
      store
    });
  } catch (error) {
    console.error('Get Store Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get User's Store
router.get('/my/store', authMiddleware, async (req, res) => {
  console.log(req.user.id)
 
  try {
    const store = await Store.findOne({ owner: req.user.id })
      .populate('owner', 'name email username profileImage');





 

 







      
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'No store found'
      });
    }

    res.json({
      success: true,
      store
    });
  } catch (error) {
    console.error('Get My Store Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Update Store
router.put('/:id', 
  authMiddleware,
  upload.array('images', 5),
  async (req, res) => {
    try {
      const store = await Store.findById(req.params.id);

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }

      // Check ownership
      if (store.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this store'
        });
      }

      const updates = req.body;
      
      // Handle images
      if (req.files && req.files.length > 0) {
        updates.images = [
          ...store.images,
          ...req.files.map(file => file.filename)
        ];
      }

      // Handle location update
      if (updates.latitude && updates.longitude) {
        updates.location = {
          type: 'Point',
          coordinates: [parseFloat(updates.longitude), parseFloat(updates.latitude)]
        };
      }

      // Handle features
      if (updates.features) {
        updates.features = JSON.parse(updates.features);
      }

      const updatedStore = await Store.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).populate('owner', 'name email username profileImage');

      res.json({
        success: true,
        message: 'Store updated successfully',
        store: updatedStore
      });
    } catch (error) {
      console.error('Update Store Error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  }
);

// Delete Store Image
router.delete('/:id/images/:imageName', authMiddleware, async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    if (store.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const imageIndex = store.images.indexOf(req.params.imageName);
    if (imageIndex > -1) {
      store.images.splice(imageIndex, 1);
      await store.save();
    }

    res.json({
      success: true,
      message: 'Image removed successfully'
    });
  } catch (error) {
    console.error('Delete Image Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;