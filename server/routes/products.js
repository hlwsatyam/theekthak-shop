const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Store = require('../models/Store');
const multer = require('multer');
const path = require('path');
const {authMiddleware} = require('../middleware/auth');

// Multer configuration for product images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/products/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
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

// Create Product
router.post('/', 
  authMiddleware,
  upload.array('images', 5),
  async (req, res) => {
    try {
      const { 
        name, 
        description, 
        price, 
        category,
        store,
        stock,
        unit,
        discount,
        attributes,
        tags
      } = req.body;

      // Check if store exists and belongs to user
      const storeDoc = await Store.findOne({ 
        _id: store, 
        owner: req.user.id 
      });

      if (!storeDoc) {
        return res.status(404).json({
          success: false,
          message: 'Store not found or not authorized'
        });
      }

      // Check if store has active subscription
      // if (!storeDoc.subscription.isSubscribed) {
      //   return res.status(403).json({
      //     success: false,
      //     message: 'Store subscription required to add products'
      //   });
      // }

      const images = req.files ? req.files.map(file => file.filename) : [];



    if (!images  || !images?.length>0      ) {
        return res.status(410).json({
          success: false,
          message: 'Need a atleast 2 pic of images'
        });
      }
 



      const product = new Product({
        name,
        description,
        price: parseFloat(price),
        category,
        store: storeDoc._id,
        images,
        stock: stock ? parseInt(stock) : 0,
        unit: unit || 'piece',
        discount: discount ? parseFloat(discount) : 0,
        attributes: attributes ? JSON.parse(attributes) : {},
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      });

      await product.save();

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product
      });
    } catch (error) {
      console.error('Create Product Error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  }
);

// Get Store Products
router.get('/store/:storeId', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = { 
      store: req.params.storeId,
      isAvailable: true 
    };

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const products = await Product.find(query)
      .populate('store', 'name')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    const total = await Product.countDocuments(query);
 
    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      products
    });
  } catch (error) {
    console.error('Get Store Products Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get Product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('store', 'name address location rating images subscription');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Update Product
router.put('/:id', 
  authMiddleware,
  upload.array('images', 5),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id)
        .populate('store');

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check ownership through store
      if (product.store.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this product'
        });
      }

      const updates = req.body;

      // Handle images
      if (req.files && req.files.length > 0) {
        updates.images = [
          ...product.images,
          ...req.files.map(file => file.filename)
        ];
      }

      // Parse numeric fields
      if (updates.price) updates.price = parseFloat(updates.price);
      if (updates.stock) updates.stock = parseInt(updates.stock);
      if (updates.discount) updates.discount = parseFloat(updates.discount);
      if (updates.attributes) updates.attributes = JSON.parse(updates.attributes);
      if (updates.tags) updates.tags = updates.tags.split(',').map(tag => tag.trim());

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).populate('store', 'name');

      res.json({
        success: true,
        message: 'Product updated successfully',
        product: updatedProduct
      });
    } catch (error) {
      console.error('Update Product Error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  }
);

// Delete Product
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('store');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.store.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    await product.deleteOne();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Delete Product Image
router.delete('/:id/images/:imageName', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('store');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.store.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const imageIndex = product.images.indexOf(req.params.imageName);
    if (imageIndex > -1) {
      product.images.splice(imageIndex, 1);
      await product.save();
    }

    res.json({
      success: true,
      message: 'Image removed successfully'
    });
  } catch (error) {
    console.error('Delete Product Image Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;