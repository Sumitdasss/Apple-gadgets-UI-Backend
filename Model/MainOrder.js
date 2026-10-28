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
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        name: {
          type: String,
          required: true,
          trim: true,
        },

        price: {
          type: Number,
          required: true,
          min: 0,
        },

        costPrice: {
          type: Number,
          required: false,
          default: 0,
          min: 0,
        },

        quantity: {
          type: Number,
          required: true,
          default: 1,
          min: 1,
        },

        color: {
          type: String,
          default: "",
          trim: true,
        },

        ram: {
          type: String,
          default: "",
          trim: true,
        },

        storage: {
          type: String,
          default: "",
          trim: true,
        },

        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },

        sku: {
          type: String,
          default: "",
          trim: true,
        },

        size: {
          type: String,
          default: "",
          trim: true,
        },

        image: {
          type: String,
          default: "",
        },

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
      enum: [
        "cash_on_delivery",
        "online_payment",
        "partial_payment",
      ],
      default: "cash_on_delivery",
    },

    paymentStatus: {
      type: String,
      enum: [
        "unpaid",
        "pending",
        "partially_paid",
        "paid",
        "failed",
        "cancelled",
        "review",
      ],
      default: "unpaid",
    },

    // =========================
    // SSLCOMMERZ PAYMENT DETAILS
    // =========================
    paymentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentCurrency: {
      type: String,
      default: "BDT",
    },

sslcommerzTranId: {
  type: String,
  default: null,
},

    sslcommerzExpectedAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    sslcommerzValidationId: {
      type: String,
      default: null,
    },

    bankTransactionId: {
      type: String,
      default: null,
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
    // COURIER INFORMATION — update this block
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
  // Custom delivery person (manual assign)
  riderName: {
    type: String,
    default: "",
    trim: true,
  },
  riderPhone: {
    type: String,
    default: "",
    trim: true,
  },
  riderEmail: {
    type: String,
    default: "",
    trim: true,
  },
  riderAddress: {
    type: String,
    default: "",
    trim: true,
  },
},

statusHistory: [
  {
    status: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
],


    // =========================
    // EMPLOYEE ASSIGNMENT
    // =========================
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

    deliveryStatus: {
      type: String,
      enum: [
        "unassigned",
        "assigned",
        "picked_up",
        "in_transit",
        "delivered",
        "failed",
        "returned",
        "cancelled",
      ],
      default: "unassigned",
    },

    deliveryNote: {
      type: String,
      default: "",
      trim: true,
    },

    deliveryHistory: [
      {
        status: {
          type: String,
          required: true,
          trim: true,
        },

        note: {
          type: String,
          default: "",
          trim: true,
        },

        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
          default: null,
        },

        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

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
  }
);

// =========================
// INDEXES
// =========================
orderSchema.index({ createdAt: -1 });
orderSchema.index({ assignedEmployee: 1, deliveryStatus: 1 });
orderSchema.index({ assignedBy: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ sslcommerzTranId: 1 });

// =========================
// MODEL
// =========================
const MainOrder =
  mongoose.models.MainOrder ||
  mongoose.model("MainOrder", orderSchema);

export default MainOrder;