import mongoose from "mongoose"

const conversationSchema = new mongoose.Schema(
  {
    messengerId: {
      type: String,
      required: true,
      unique: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },

    state: {
      type: String,
      default: "idle",
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },

    productName: {
      type: String,
      default: "",
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

    temporaryOrder: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

 export default  Conversation