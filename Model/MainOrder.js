import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // =========================
    // ORDER BASIC INFORMATION
    // =========================
    orderId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    // =========================
    // CUSTOMER INFORMATION
    // =========================
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
      trim: true,
    },

    deliveryAddress: {
      type: String,
      required: true,
      trim: true,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },

    // =========================
    // ORDERED PRODUCTS
    // =========================
    products: [
      {
        // Product MongoDB ID
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        // Product name snapshot
        name: {
          type: String,
          required: true,
          trim: true,
        },

        // Product/Variant price at the time of order
        price: {
          type: Number,
          required: true,
          min: 0,
        },

        quantity: {
          type: Number,
          required: true,
          default: 1,
          min: 1,
        },

        // =========================
        // PRODUCT VARIANT
        // =========================

        // Selected color
        color: {
          type: String,
          default: "",
          trim: true,
        },

        // Selected RAM
        ram: {
          type: String,
          default: "",
          trim: true,
        },

        // Selected Storage
        storage: {
          type: String,
          default: "",
          trim: true,
        },

        // Variant MongoDB ID
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },

        // Variant SKU
        sku: {
          type: String,
          default: "",
          trim: true,
        },

        // Old size field
        // Kept for compatibility with old orders/products
        size: {
          type: String,
          default: "",
          trim: true,
        },

        // Optional image snapshot
        image: {
          type: String,
          default: "",
        },

        // Optional subtotal for this product
        subtotal: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],

    // =========================
    // ORDER CALCULATION
    // =========================
    subTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    couponCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // =========================
    // PAYMENT INFORMATION
    // =========================
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

    // =========================
    // DELIVERY METHOD
    // =========================
    deliveryMethod: {
      type: String,
      enum: ["courier_service", "shop_pickup"],
      default: "courier_service",
    },

    // =========================
    // COURIER INFORMATION
    // =========================
    courierDetails: {
      provider: {
        type: String,
        default: "",
        trim: true,
      },

      trackingCode: {
        type: String,
        default: "",
        trim: true,
      },

      consignmentId: {
        type: String,
        default: "",
        trim: true,
      },

      courierStatus: {
        type: String,
        default: "",
        trim: true,
      },
    },

    // =========================
    // ORDER STATUS
    // =========================
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

    // =========================
    // TERMS
    // =========================
    termsAgreed: {
      type: Boolean,
      required: true,
      default: true,
    },

    // =========================
    // ORDER SOURCE
    // =========================
    source: {
      type: String,
      default: "website",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);
orderSchema.index({ createdAt: -1 });
const MainOrder =
  mongoose.models.MainOrder || mongoose.model("MainOrder", orderSchema);

export default MainOrder;
