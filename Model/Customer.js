import mongoose from "mongoose"

const customerSchema = new mongoose.Schema(
  {
    messengerId: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
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

 const Customer =
  mongoose.models.Customer ||
  mongoose.model("Customer", customerSchema);

  export default Customer