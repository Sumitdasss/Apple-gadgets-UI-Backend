
import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    role: {
      type: String,
      enum: ["customer", "admin", "order_manager"],
      default: "customer",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Email permanently verified or not
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Registration email verification OTP
    emailOtpHash: {
      type: String,
      select: false,
    },

    emailOtpExpires: {
      type: Date,
      select: false,
    },

    // New OTP for every login
    loginOtpHash: {
      type: String,
      select: false,
    },

    loginOtpExpires: {
      type: Date,
      select: false,
    },

    // Pending login OTP expires after 5 minutes
    loginOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.index({ createdAt: -1 });

const Customer =
  mongoose.models.Customer ||
  mongoose.model("Customer", customerSchema);

export default Customer;
