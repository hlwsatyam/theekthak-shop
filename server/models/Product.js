const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: Number,
  category: {
    type: String,
    required: true
  },
  subcategory: String,
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  images: [String],
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: 'piece'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  attributes: {
    type: Map,
    of: String
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

productSchema.index({ name: 'text', description: 'text', category: 'text' });
productSchema.index({ store: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isFeatured: 1 });

productSchema.pre('save', function(next) {
  if (this.isModified('price') || this.isModified('discount')) {
    if (this.originalPrice === undefined) {
      this.originalPrice = this.price;
    }
  }
  this.updatedAt = Date.now();
  next();
});

productSchema.virtual('discountedPrice').get(function() {
  if (this.discount > 0) {
    return this.price - (this.price * this.discount / 100);
  }
  return this.price;
});

module.exports = mongoose.model('Product', productSchema);