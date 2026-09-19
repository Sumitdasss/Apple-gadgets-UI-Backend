import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    // ==============================
    // CATEGORY NAME
    // ==============================
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ==============================
    // SLUG
    // ==============================
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // ==============================
    // PARENT CATEGORY
    // ==============================
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // ==============================
    // CATEGORY LEVEL
    // ==============================
    level: {
      type: Number,
      default: 0,
    },

    // ==============================
    // FULL CATEGORY PATH
    // ==============================
    path: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // ==============================
    // DESCRIPTION
    // ==============================
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // ==============================
    // IMAGE
    // ==============================
    image: {
      type: String,
      default: "",
    },

    // ==============================
    // STATUS
    // ==============================
    isActive: {
      type: Boolean,
      default: true,
    },

    // ==============================
    // SORT ORDER
    // ==============================
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// SAME SLUG ALLOWED UNDER DIFFERENT PARENTS
// =====================================================
//
// parent = null + slug = macbook   → unique
// parent = ABC  + slug = macbook   → unique
// parent = XYZ  + slug = macbook   → unique
//
// কিন্তু একই parent-এর মধ্যে:
// parent = ABC + slug = macbook
// parent = ABC + slug = macbook   → NOT ALLOWED
//
categorySchema.index(
  {
    parent: 1,
    slug: 1,
  },
  {
    unique: true,
  }
);

const Category =
  mongoose.models.Category ||
  mongoose.model("Category", categorySchema);

export default Category;