
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        price: Number,
        quantity: {
          type: Number,
          default: 1,
        },
        color: {
          type: String,
          default: "",
        },
        size: {
          type: String,
          default: "",
        },
      },
    ],

    totalAmount: {
      type: Number,
      default: 0,
    },

    deliveryAddress: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    // Existing order status — kept for compatibility
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    source: {
      type: String,
      default: "facebook_messenger",
    },

    // Employee currently responsible for delivery
    assignedEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    // Delivery workflow, separate from the existing order status
    deliveryStatus: {
      type: String,
      enum: [
        "unassigned",
        "assigned",
        "received",
        "delivered",
        "rejected",
        "cancelled",
      ],
      default: "unassigned",
    },

    deliveryNote: {
      type: String,
      default: "",
    },

    // Audit trail of assignments and status changes
    deliveryHistory: [
      {
        action: {
          type: String,
          enum: [
            "assigned",
            "reassigned",
            "received",
            "delivered",
            "rejected",
            "cancelled",
          ],
          required: true,
        },

        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
          default: null,
        },

      changedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Customer",
  default: null,
},

        note: {
          type: String,
          default: "",
        },

        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Order =
  mongoose.models.Order ||
  mongoose.model("Order", orderSchema);

export default Order;
