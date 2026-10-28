
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt } from "crypto";

import Customer from "../Model/Customer.js";
import { apiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOtpEmail } from "../Service/SendOtpHandler.js";

import {
  getCustomerCache,
  setCustomerCache,
  clearCustomerCache,
} from "../utils/customerCache.js";

// =====================================================
// CONFIG
// =====================================================

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_LOGIN_OTP_ATTEMPTS = 5;

// =====================================================
// COMMON HELPERS
// =====================================================

const generateOtp = () => randomInt(100000, 1000000).toString();

const createOtpExpiry = () =>
  new Date(Date.now() + OTP_EXPIRY_MS);

const normalizeEmail = (email = "") =>
  email.trim().toLowerCase();

const isValidId = (id) =>
  mongoose.isValidObjectId(id);

const sanitizeCustomer = (customer) => {
  if (!customer) return null;

  const user =
    typeof customer.toObject === "function"
      ? customer.toObject()
      : { ...customer };

  delete user.password;
  delete user.emailOtpHash;
  delete user.emailOtpExpires;
  delete user.loginOtpHash;
  delete user.loginOtpExpires;
  delete user.loginOtpAttempts;
  delete user.otp;
  delete user.otpHash;
  delete user.resetPasswordToken;

  return user;
};

// Expiry check and cleanup for registration OTP.
const clearExpiredEmailOtp = async (customer) => {
  const expired =
    !customer.emailOtpHash ||
    !customer.emailOtpExpires ||
    new Date(customer.emailOtpExpires).getTime() <= Date.now();

  if (expired) {
    customer.emailOtpHash = null;
    customer.emailOtpExpires = null;
    await customer.save();
  }

  return expired;
};

// Expiry check and cleanup for login OTP.
const clearExpiredLoginOtp = async (customer) => {
  const expired =
    !customer.loginOtpHash ||
    !customer.loginOtpExpires ||
    new Date(customer.loginOtpExpires).getTime() <= Date.now();

  if (expired) {
    customer.loginOtpHash = null;
    customer.loginOtpExpires = null;
    customer.loginOtpAttempts = 0;
    await customer.save();
  }

  return expired;
};

// =====================================================
// REGISTER
// =====================================================

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, address, phone } = req.body;

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof address !== "string" ||
    typeof phone !== "string" ||
    !name.trim() ||
    !email.trim() ||
    !password ||
    !address.trim() ||
    !phone.trim()
  ) {
    return apiResponse(res, 400, "All fields are required");
  }

  if (password.length < 6) {
    return apiResponse(
      res,
      400,
      "Password must be at least 6 characters"
    );
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = phone.trim();

  const existingCustomer = await Customer.findOne({
    $or: [
      { email: normalizedEmail },
      { phone: normalizedPhone },
    ],
  });

  if (existingCustomer) {
    if (existingCustomer.email === normalizedEmail) {
      return apiResponse(res, 409, "Email already registered");
    }

    return apiResponse(res, 409, "Phone number already registered");
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const hashedPassword = await bcrypt.hash(password, 10);

  const customer = await Customer.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    address: address.trim(),
    phone: normalizedPhone,
    isEmailVerified: false,
    emailOtpHash: otpHash,
    emailOtpExpires: createOtpExpiry(),
  });

  try {
    await sendOtpEmail(
      customer.email,
      otp,
      customer.name,
      "verify"
    );
  } catch (error) {
    console.error("Registration OTP email failed:", error);

    customer.emailOtpHash = null;
    customer.emailOtpExpires = null;
    await customer.save();

    return apiResponse(
      res,
      502,
      "Account created, but OTP email failed. Request a new OTP."
    );
  }

  return apiResponse(
    res,
    201,
    "Account created. Check your email for the verification OTP.",
    {
      email: customer.email,
      requiresEmailVerification: true,
    }
  );
});

// =====================================================
// VERIFY REGISTRATION EMAIL OTP AND AUTO LOGIN
// =====================================================

export const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (
    typeof email !== "string" ||
    typeof otp !== "string" ||
    !email.trim() ||
    !otp.trim()
  ) {
    return apiResponse(res, 400, "Email and OTP are required");
  }

  const cleanOtp = otp.trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    return apiResponse(res, 400, "OTP must contain 6 digits");
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  }).select("+emailOtpHash +emailOtpExpires");

  if (!customer) {
    return apiResponse(res, 404, "Account not found");
  }

  if (customer.isEmailVerified) {
    return apiResponse(
      res,
      400,
      "Email already verified. Please log in."
    );
  }

  // Expired OTP is cleared when verification is attempted.
  if (await clearExpiredEmailOtp(customer)) {
    return apiResponse(
      res,
      400,
      "OTP expired. Please request a new OTP."
    );
  }

  const isCorrect = await bcrypt.compare(
    cleanOtp,
    customer.emailOtpHash
  );

  if (!isCorrect) {
    return apiResponse(res, 400, "Invalid OTP");
  }

  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  customer.isEmailVerified = true;
  customer.emailOtpHash = null;
  customer.emailOtpExpires = null;

  await customer.save();

  const token = jwt.sign(
    {
      id: customer._id.toString(),
      role: customer.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "7d" }
  );

  return apiResponse(
    res,
    200,
    "Email verified successfully. You are now logged in.",
    {
      user: sanitizeCustomer(customer),
      token,
    }
  );
});

// =====================================================
// RESEND REGISTRATION OTP
// =====================================================

export const resendEmailOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (typeof email !== "string" || !email.trim()) {
    return apiResponse(res, 400, "Email is required");
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  });

  if (!customer) {
    return apiResponse(res, 404, "Account not found");
  }

  if (customer.isEmailVerified) {
    return apiResponse(res, 400, "Email already verified");
  }

  const otp = generateOtp();

  customer.emailOtpHash = await bcrypt.hash(otp, 10);
  customer.emailOtpExpires = createOtpExpiry();

  await customer.save();

  try {
    await sendOtpEmail(
      customer.email,
      otp,
      customer.name,
      "verify"
    );
  } catch (error) {
    console.error("Resend email OTP failed:", error);

    customer.emailOtpHash = null;
    customer.emailOtpExpires = null;
    await customer.save();

    return apiResponse(res, 502, "Could not send OTP email");
  }

  return apiResponse(
    res,
    200,
    "A new verification OTP has been sent"
  );
});

// =====================================================
// LOGIN: EMAIL + PASSWORD, THEN SEND OTP
// =====================================================

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return apiResponse(
      res,
      400,
      "Email and password are required"
    );
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  }).select("+password");

  if (!customer || !customer.password) {
    return apiResponse(res, 401, "Invalid email or password");
  }

  const passwordCorrect = await bcrypt.compare(
    password,
    customer.password
  );

  if (!passwordCorrect) {
    return apiResponse(res, 401, "Invalid email or password");
  }

  if (customer.isActive === false) {
    return apiResponse(res, 403, "Your account is inactive");
  }

  if (!customer.isEmailVerified) {
    return apiResponse(
      res,
      403,
      "Please verify your email before logging in"
    );
  }

  const otp = generateOtp();

  customer.loginOtpHash = await bcrypt.hash(otp, 10);
  customer.loginOtpExpires = createOtpExpiry();
  customer.loginOtpAttempts = 0;

  await customer.save();

  try {
    await sendOtpEmail(
      customer.email,
      otp,
      customer.name,
      "login"
    );
  } catch (error) {
    console.error("Login OTP email failed:", error);

    customer.loginOtpHash = null;
    customer.loginOtpExpires = null;
    customer.loginOtpAttempts = 0;

    await customer.save();

    return apiResponse(res, 502, "Could not send login OTP");
  }

  return apiResponse(
    res,
    200,
    "Login OTP sent to your email",
    {
      email: customer.email,
      requiresLoginOtp: true,
    }
  );
});

// =====================================================
// VERIFY LOGIN OTP AND ISSUE JWT
// =====================================================

export const verifyLoginOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (
    typeof email !== "string" ||
    typeof otp !== "string" ||
    !email.trim() ||
    !otp.trim()
  ) {
    return apiResponse(res, 400, "Email and OTP are required");
  }

  const cleanOtp = otp.trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    return apiResponse(res, 400, "OTP must contain 6 digits");
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  }).select(
    "+loginOtpHash +loginOtpExpires +loginOtpAttempts"
  );

  if (!customer) {
    return apiResponse(res, 404, "Account not found");
  }

  if (
    customer.isActive === false ||
    !customer.isEmailVerified
  ) {
    return apiResponse(
      res,
      403,
      "Account is not eligible to log in"
    );
  }

  if (await clearExpiredLoginOtp(customer)) {
    return apiResponse(
      res,
      400,
      "Login OTP expired. Please log in again."
    );
  }

  if (
    (customer.loginOtpAttempts || 0) >= MAX_LOGIN_OTP_ATTEMPTS
  ) {
    customer.loginOtpHash = null;
    customer.loginOtpExpires = null;
    customer.loginOtpAttempts = 0;

    await customer.save();

    return apiResponse(
      res,
      429,
      "Too many incorrect OTP attempts. Please log in again."
    );
  }

  const isCorrect = await bcrypt.compare(
    cleanOtp,
    customer.loginOtpHash
  );

  if (!isCorrect) {
    customer.loginOtpAttempts =
      (customer.loginOtpAttempts || 0) + 1;

    if (
      customer.loginOtpAttempts >= MAX_LOGIN_OTP_ATTEMPTS
    ) {
      customer.loginOtpHash = null;
      customer.loginOtpExpires = null;
      customer.loginOtpAttempts = 0;

      await customer.save();

      return apiResponse(
        res,
        429,
        "Too many incorrect OTP attempts. Please log in again."
      );
    }

    await customer.save();

    return apiResponse(res, 400, "Invalid OTP");
  }

  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  const token = jwt.sign(
    {
      id: customer._id.toString(),
      role: customer.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "7d" }
  );

  // Clear OTP after successful verification.
  customer.loginOtpHash = null;
  customer.loginOtpExpires = null;
  customer.loginOtpAttempts = 0;

  await customer.save();

  return apiResponse(res, 200, "Login successful", {
    user: sanitizeCustomer(customer),
    token,
  });
});

// =====================================================
// GET MY PROFILE
// =====================================================

export const getMyProfile = asyncHandler(async (req, res) => {
  if (!req.user) {
    return apiResponse(res, 401, "Authentication required");
  }

  return apiResponse(
    res,
    200,
    "Profile fetched successfully",
    sanitizeCustomer(req.user)
  );
});

// =====================================================
// GET ALL CUSTOMERS
// GET /api/customers/AllCustomers
// =====================================================

export const getAllCustomers = async (req, res) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all");

    const cacheKey = JSON.stringify({
      page,
      limit,
      search,
      status,
    });

    const cached = await getCustomerCache(cacheKey);

    if (cached !== null) {
      res.set("X-Cache", "HIT");
      return res.status(200).json(cached);
    }

    const filter = {};

    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const regex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "blocked") {
      filter.isActive = false;
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .select(
          "_id name email phone address role isActive isEmailVerified createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Customer.countDocuments(filter),
    ]);

    const response = {
      success: true,
      message: "Customers fetched successfully",
      data: {
        customers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    };

    await setCustomerCache(cacheKey, response);

    res.set("X-Cache", "MISS");
    return res.status(200).json(response);
  } catch (error) {
    console.error("Get customers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};

// =====================================================
// GET CUSTOMER BY ID
// GET /api/customers/getCustomer/:id
// =====================================================

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const customer = await Customer.findById(id)
      .select(
        "-password -emailOtpHash -emailOtpExpires -loginOtpHash -loginOtpExpires -loginOtpAttempts -resetPasswordToken -otp -otpHash"
      )
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer details fetched successfully",
      data: {
        customer,
      },
    });
  } catch (error) {
    console.error("getCustomerById error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer details",
    });
  }
};

// =====================================================
// UPDATE CUSTOMER STATUS
// PATCH /api/customers/updateCustomerStatus/:id
// =====================================================

export const updateCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
    }

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (customer.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be blocked here",
      });
    }

    customer.isActive = isActive;

    await customer.save();
    await clearCustomerCache();

    return res.status(200).json({
      success: true,
      message: isActive
        ? "Customer unblocked successfully"
        : "Customer blocked successfully",
      data: {
        _id: customer._id,
        name: customer.name,
        isActive: customer.isActive,
      },
    });
  } catch (error) {
    console.error("Update customer status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update customer status",
    });
  }
};

// =====================================================
// DELETE CUSTOMER
// DELETE /api/customers/deleteCustomer/:id
// =====================================================

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (customer.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be deleted here",
      });
    }

    await Customer.deleteOne({ _id: customer._id });
    await clearCustomerCache();

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      data: {
        _id: customer._id,
      },
    });
  } catch (error) {
    console.error("Delete customer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete customer",
    });
  }
};

// =====================================================
// UPDATE CUSTOMER ROLE
// =====================================================

export const updateCustomerRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = [
      "customer",
      "admin",
      "subadmin",
      "employee",
      "order_manager",
    ];

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    if (
      typeof role !== "string" ||
      !allowedRoles.includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer role",
        allowedRoles,
      });
    }

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    customer.role = role;

    await customer.save();
    await clearCustomerCache();

    return res.status(200).json({
      success: true,
      message: "Customer role updated successfully",
      data: {
        customer: {
          _id: customer._id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          role: customer.role,
          isActive: customer.isActive,
        },
      },
    });
  } catch (error) {
    console.error("Update customer role error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update customer role",
      ...(process.env.NODE_ENV === "development"
        ? { error: error.message }
        : {}),
    });
  }
};
