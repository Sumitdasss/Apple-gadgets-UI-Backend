
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import Customer from "../Model/Customer.js";
import { apiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ================= REGISTER =================
export const register = asyncHandler(async (req, res) => {
  const { name, email, password,address,phone } = req.body;

  // Check required fields
  if (!name || !email || !password || !address || !phone) {
    return apiResponse(
      res,
      400,
      "All fields are required"
    );
  }

  // Check existing user
  const existingUser = await Customer.findOne({
    email: email.toLowerCase().trim(),
  });
  const existingPhone = await Customer.findOne({
    phone: phone.trim(),
  });

  if (existingUser) {
    return apiResponse(res, 409, "Email already registered");
  }

  if (existingPhone) {
    return apiResponse(res, 409, "Phone number already registered");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const customer = await Customer.create({
    name,
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    address,
    phone,
  });

  // Remove password from response
  const user = customer.toObject();
  delete user.password;

  return apiResponse(res, 201, "Registration successful", user);
});

// ================= LOGIN =================

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return apiResponse(res, 400, "Email and password are required");
  }

  // Password field explicitly আনবে
  const customer = await Customer.findOne({
    email: email.trim().toLowerCase(),
  }).select("+password");

  if (!customer) {
    return apiResponse(res, 401, "Invalid email or password");
  }

  // Debug: password hash আসছে কি না পরীক্ষা
  console.log("Customer found:", customer._id);
  console.log("Password exists:", Boolean(customer.password));

  if (!customer.password) {
    return apiResponse(res, 500, "Password hash not found for this account");
  }

  const isPasswordCorrect = await bcrypt.compare(
    password,
    customer.password
  );

  if (!isPasswordCorrect) {
    return apiResponse(res, 401, "Invalid email or password");
  }

  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  const token = jwt.sign(
    { id: customer._id.toString() },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "7d" }
  );

  const user = customer.toObject();
  delete user.password;

  return apiResponse(res, 200, "Login successful", {
    user,
    token,
  });
});



export const getMyProfile = asyncHandler(async (req, res) => {
  const user = req.user.toObject();

  delete user.password;

  return apiResponse(
    res,
    200,
    "Profile fetched successfully",
    user
  );
});
