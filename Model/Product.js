
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    shortDescription: {
      type: String,
    },

    // ==========================================
    // CATEGORY
    // ==========================================
   category: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Category",
  required: true,
},

subCategory: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Category",
  default: null,
},

childCategory: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Category",
  default: null,
},
subChildCategory: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Category",
  default: null,
},

    // ==========================================
    // CATEGORY PATH
    // Example:
    // Mobile Phone
    // → iPhone
    // → iPhone 18 Series
    // ==========================================
    categoryPath: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // ==========================================
    // BRAND
    // ==========================================
    brand: {
      type: String,
      trim: true,
    },

    // ==========================================
    // PRICE
    // ==========================================
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ==========================================
    // INVENTORY
    // ==========================================
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    sku: {
      type: String,
      unique: true,
      trim: true,
    },

    // ==========================================
    // IMAGES
    // ==========================================
    images: [
      {
        type: String,
      },
    ],

    thumbnail: {
      type: String,
    },

    // ==========================================
    // COLORS
    // ==========================================
    colors: [
      {
        name: String,
        code: String,
      },
    ],

    // ==========================================
    // SIZES
    // ==========================================
    sizes: [
      {
        type: String,
      },
    ],

    // ==========================================
    // SPECIFICATIONS
    // ==========================================
    specifications: [
      {
        key: {
          type: String,
          trim: true,
        },

        value: {
          type: String,
          trim: true,
        },
      },
    ],

    // ==========================================
    // RATING
    // ==========================================
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    numReviews: {
      type: Number,
      default: 0,
    },

    // ==========================================
    // STATUS
    // ==========================================
    isActive: {
      type: Boolean,
      default: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

isNewProduct: {
  type: Boolean,
  default: false,
},

    isBestSeller: {
      type: Boolean,
      default: false,
    },

    // ==========================================
    // SEO
    // ==========================================
    metaTitle: {
      type: String,
    },

    metaDescription: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model(
  "Product",
  productSchema
);

export default Product;