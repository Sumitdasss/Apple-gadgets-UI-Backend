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

    // Customer Contact Details (Image Forms)
    customerName: {
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

    selectArea: {
      type: String,
      required: true,
    },

    deliveryAddress: {
      type: String,
      required: true,
    },

    note: {
      type: String,
      default: "",
    },

    // Ordered Products List
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
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

    // Order Calculation Breakdown
    subTotal: {
      type: Number,
      required: true,
      default: 0,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },

    couponCode: {
      type: String,
      default: "",
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    // Payment Info
    paymentMethod: {
      type: String,
      enum: ["cash_on_delivery", "online_payment", "partial_payment"],
      default: "cash_on_delivery",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid"],
      default: "unpaid",
    },

    // Delivery Method & Courier Integration Details
    deliveryMethod: {
      type: String,
      enum: ["courier_service", "shop_pickup"],
      default: "courier_service",
    },

    courierDetails: {
      provider: {
        type: String,
        default: "", // e.g., "Steadfast", "Pathao", "Paperfly"
      },
      trackingCode: {
        type: String,
        default: "",
      },
      consignmentId: {
        type: String,
        default: "",
      },
      courierStatus: {
        type: String,
        default: "",
      },
    },

    // Updated Complete Order Status Lifecycle
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "ready_for_shipment",
        "handed_over_to_courier",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
      default: "pending",
    },

    termsAgreed: {
      type: Boolean,
      required: true,
      default: true,
    },

    source: {
      type: String,
      default: "website",
    },
  },
  {
    timestamps: true,
  }
);

const MainOrder =
  mongoose.models.MainOrder || mongoose.model("MainOrder", orderSchema);

export default MainOrder;