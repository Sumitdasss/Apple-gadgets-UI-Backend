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
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    shortDescription: {
      type: String,
      default: "",
    },

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
additionalCategories: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
  },
],
    brand: {
      type: String,
      default: "",
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    discountPercentage: {
      type: Number,
      default: 0,
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
    },

    sku: {
      type: String,
      default: "",
      trim: true,
    },

    // =========================
    // COLORS
    // =========================
    colors: [
  {
    name: {
      type: String,
      trim: true,
    },

    code: {
      type: String,
      trim: true,
    },

    image: {
      type: String,
      trim: true,
      default: "",
    },
  },
],
variants: [
  {
    color: {
      name: String,
      code: String,
      image: String,
    },

    ram: String,

    storage: String,

    stock: {
      type: Number,
      default: 0,
    },

    price: Number,

    sku: String,
  },
],
    // =========================
    // SIZES
    // =========================
    sizes: {
      type: [String],
      default: [],
    },

    // =========================
    // RAM / MEMORY
    // =========================
    ram: {
      type: [String],
      default: [],
    },

    // =========================
    // SPECIFICATIONS
    // =========================
    specifications: [
      {
        key: {
          type: String,
          required: true,
          trim: true,
        },

        value: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    // =========================
    // RATING
    // =========================
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    // =========================
    // STATUS
    // =========================
    isActive: {
      type: Boolean,
      default: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isNew: {
      type: Boolean,
      default: false,
    },

    isBestSeller: {
      type: Boolean,
      default: false,
    },

    // =========================
    // SEO
    // =========================
    metaTitle: {
      type: String,
      default: "",
    },

    metaDescription: {
      type: String,
      default: "",
    },

    // =========================
    // IMAGES
    // =========================
    images: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Product =
  mongoose.models.Product ||
  mongoose.model("Product", productSchema);

export default Product;