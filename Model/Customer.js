import mongoose from "mongoose"

const customerSchema = new mongoose.Schema({
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

  address: {
    type: String,
    default: "",
    trim: true,
  },
});
 const Customer =
  mongoose.models.Customer ||
  mongoose.model("Customer", customerSchema);

  export default Customer