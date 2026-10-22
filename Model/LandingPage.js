
import mongoose from "mongoose";

const landingSectionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "hero",
        "features",
        "products",
        "banner",
        "testimonials",
        "cta",
      ],
      required: true,
    },

    title: {
      type: String,
      default: "",
    },

    subtitle: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    buttonText: {
      type: String,
      default: "",
    },

    buttonLink: {
      type: String,
      default: "",
    },

    // Optional banner images with clickable links
    banners: [
      {
        image: {
          type: String,
          default: "",
        },
        link: {
          type: String,
          default: "",
        },
        alt: {
          type: String,
          default: "",
        },
      },
    ],

    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    features: [
      {
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        icon: { type: String, default: "" },
      },
    ],
  },
  { _id: true },
);

const landingPageSchema = new mongoose.Schema(
  {
    title: {
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
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },

    description: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },

    sections: {
      type: [landingSectionSchema],
      default: [],
    },

    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      ogImage: { type: String, default: "" },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
  },
  { timestamps: true },
);

landingPageSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model("LandingPage", landingPageSchema);
