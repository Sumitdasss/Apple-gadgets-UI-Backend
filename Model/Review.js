
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    productSlug: {
      type: String,
      default: "",
      trim: true,
    },

    productName: {
      type: String,
      default: "",
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    userName: {
      type: String,
      default: "",
      trim: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer from 1 to 5",
      },
    },

    review: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          default: "",
        },
      },
    ],

    likes: {
      type: Number,
      default: 0,
      min: 0,
    },

    replies: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

reviewSchema.index({ productId: 1, createdAt: -1 });

const Review =
  mongoose.models.Review ||
  mongoose.model("Review", reviewSchema);

export default Review;
