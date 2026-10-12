
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
      default: "",
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

    // Role-Based Authorization
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