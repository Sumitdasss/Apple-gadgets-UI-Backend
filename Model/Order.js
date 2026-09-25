import mongoose from "mongoose"

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
  },
  {
    timestamps: true,
  }
);

const Order =
  mongoose.models.Order ||
  mongoose.model("Order", orderSchema);
  export default Order