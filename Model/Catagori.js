import mongoose from "mongoose";

// =====================================================
// 1. MAIN CATEGORY SCHEMA
// =====================================================

const mainCategorySchema = new mongoose.Schema(
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
      default: "",
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    // ================================================
    // CHILD CATEGORY DETAILS
    // ================================================

    subCategories: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubCategory",
        },
      ],
      default: [],
    },

    childCategories: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ChildCategory",
        },
      ],
      default: [],
    },

    subChildCategories: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubChildCategory",
        },
      ],
      default: [],
    },

    // ================================================
    // COUNTS
    // ================================================

    counts: {
      subCategories: {
        type: Number,
        default: 0,
      },

      childCategories: {
        type: Number,
        default: 0,
      },

      subChildCategories: {
        type: Number,
        default: 0,
      },

      total: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

// =====================================================
// VIRTUALS
// =====================================================

mainCategorySchema.virtual("subCategoryDetails", {
  ref: "SubCategory",
  localField: "_id",
  foreignField: "mainCategory",
});

mainCategorySchema.virtual("childCategoryDetails", {
  ref: "ChildCategory",
  localField: "_id",
  foreignField: "mainCategory",
});

mainCategorySchema.virtual("subChildCategoryDetails", {
  ref: "SubChildCategory",
  localField: "_id",
  foreignField: "mainCategory",
});


// =====================================================
// 2. SUB CATEGORY SCHEMA
// =====================================================

const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    mainCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainCategory",
      required: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    // ================================================
    // CHILD REFERENCES
    // ================================================

    childCategories: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ChildCategory",
        },
      ],
      default: [],
    },

    subChildCategories: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubChildCategory",
        },
      ],
      default: [],
    },

    // ================================================
    // COUNTS
    // ================================================

    counts: {
      childCategories: {
        type: Number,
        default: 0,
      },

      subChildCategories: {
        type: Number,
        default: 0,
      },

      total: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },
  }
);

// Virtual
subCategorySchema.virtual("childCategoryDetails", {
  ref: "ChildCategory",
  localField: "_id",
  foreignField: "subCategory",
});

subCategorySchema.virtual("subChildCategoryDetails", {
  ref: "SubChildCategory",
  localField: "_id",
  foreignField: "subCategory",
});


// =====================================================
// 3. CHILD CATEGORY SCHEMA
// =====================================================

const childCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    mainCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainCategory",
      required: true,
    },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    // ================================================
    // SUB CHILD REFERENCES
    // ================================================

    subChildCategories: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SubChildCategory",
        },
      ],
      default: [],
    },

    // ================================================
    // COUNTS
    // ================================================

    counts: {
      subChildCategories: {
        type: Number,
        default: 0,
      },

      total: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },
  }
);

// Virtual
childCategorySchema.virtual("subChildCategoryDetails", {
  ref: "SubChildCategory",
  localField: "_id",
  foreignField: "childCategory",
});


// =====================================================
// 4. SUB CHILD CATEGORY SCHEMA
// =====================================================

const subChildCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    mainCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainCategory",
      required: true,
    },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
    },

    childCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChildCategory",
      required: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },
  }
);


// =====================================================
// EXPORT MODELS
// =====================================================

export const MainCategory =
  mongoose.models.MainCategory ||
  mongoose.model("MainCategory", mainCategorySchema);

export const SubCategory =
  mongoose.models.SubCategory ||
  mongoose.model("SubCategory", subCategorySchema);

export const ChildCategory =
  mongoose.models.ChildCategory ||
  mongoose.model("ChildCategory", childCategorySchema);

export const SubChildCategory =
  mongoose.models.SubChildCategory ||
  mongoose.model("SubChildCategory", subChildCategorySchema);