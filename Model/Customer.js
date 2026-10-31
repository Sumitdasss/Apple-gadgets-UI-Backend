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
      enum: [
        "customer",
        "admin",
        "subadmin",
        "employee",
        "order_manager",
      ],
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

    // =====================================================
    // FORGOT PASSWORD
    // Step 1: reset OTP (emailed)
    // Step 2: one-time reset token (issued after OTP is verified)
    // =====================================================
    resetOtpHash: {
      type: String,
      select: false,
    },

    resetOtpExpires: {
      type: Date,
      select: false,
    },

    resetOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    // Used for the resend cooldown
    resetOtpSentAt: {
      type: Date,
      select: false,
    },

    // SHA-256 hash of the one-time reset token
    resetTokenHash: {
      type: String,
      select: false,
    },

    resetTokenExpires: {
      type: Date,
      select: false,
    },

    // Set when the password changes (use it to invalidate old JWTs)
    passwordChangedAt: {
      type: Date,
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