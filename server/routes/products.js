const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');

// Multer configuration for multiple files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Add product
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    const { name, description, price, store, category } = req.body;
    console.log(req.body.name)
    const images = req.files ? req.files.map(file => file.filename) : [];

    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      store,
      category,
      images
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get products by store
router.get('/store/:storeId', async (req, res) => {
  try {
    const products = await Product.find({ store: req.params.storeId });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;