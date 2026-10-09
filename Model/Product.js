import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    // =========================
    // BASIC
    // =========================

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

    // =========================
    // 4 LEVEL CATEGORY
    // =========================

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainCategory",
      required: true,
    },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null,
    },

    childCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChildCategory",
      default: null,
    },

    subChildCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubChildCategory",
      default: null,
    },

    // =========================
    // ADDITIONAL CATEGORIES
    // =========================

    additionalCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MainCategory",
      },
    ],

    // =========================
    // BRAND
    // =========================

    brand: {
      type: String,
      default: "",
      trim: true,
    },

    // =========================
    // PRICE
    // =========================

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
      min: 0,
      max: 100,
    },

    // =========================
    // STOCK
    // =========================

    stock: {
      type: Number,
      
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

    // =========================
    // VARIANTS
    // =========================

    variants: [
      {
        color: {
          name: {
            type: String,
            default: "",
          },

          code: {
            type: String,
            default: "",
          },

          image: {
            type: String,
            default: "",
          },
        },

        ram: {
          type: String,
          default: "",
        },

        storage: {
          type: String,
          default: "",
        },

        stock: {
          type: Number,
          default: 0,
          min: 0,
        },

        price: {
          type: Number,
          min: 0,
        },

        sku: {
          type: String,
          default: "",
        },
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
productSchema.index({ createdAt: -1 });
const Product =
  mongoose.models.Product ||
  mongoose.model("Product", productSchema);

export default Product;