
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { randomInt } from "crypto";

import Customer from "../Model/Customer.js";
import { apiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOtpEmail } from "../Service/SendOtpHandler.js";

// ======================================================
// CONFIGURATION
// ======================================================

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_LOGIN_OTP_ATTEMPTS = 5;

const ALLOWED_ROLES = [
  "customer",
  "admin",
  "subadmin",
  "employee",
];

const generateOtp = () => randomInt(100000, 1000000).toString();

const createOtpExpiry = () =>
  new Date(Date.now() + OTP_EXPIRY_MS);

const normalizeEmail = (email) =>
  email.trim().toLowerCase();

const sanitizeCustomer = (customer) => {
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
  delete user.__v;

  return user;
};

const validObjectId = (id) =>
  mongoose.isValidObjectId(id);

// ======================================================
// REGISTER
// Public registration always creates a CUSTOMER.
// Never trust role sent by the frontend.
// ======================================================

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

  const existingEmail = await Customer.findOne({
    email: normalizedEmail,
  });

  if (existingEmail) {
    return apiResponse(res, 409, "Email already registered");
  }

  const existingPhone = await Customer.findOne({
    phone: normalizedPhone,
  });

  if (existingPhone) {
    return apiResponse(res, 409, "Phone number already registered");
  }

  const otp = generateOtp();

  const customer = await Customer.create({
    name: name.trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
    address: address.trim(),
    phone: normalizedPhone,

    role: "customer",
    isActive: true,
    isEmailVerified: false,

    emailOtpHash: await bcrypt.hash(otp, 10),
    emailOtpExpires: createOtpExpiry(),
  });

  try {
    // Preserve the argument order used by your original code.
    await sendOtpEmail(
      normalizedEmail,
      otp,
      name.trim(),
      "verify"
    );
  } catch (error) {
    console.error("Registration OTP email failed:", error.message);

    customer.emailOtpHash = undefined;
    customer.emailOtpExpires = undefined;
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

// ======================================================
// VERIFY REGISTRATION EMAIL OTP
// ======================================================

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

  if (!/^\d{6}$/.test(otp.trim())) {
    return apiResponse(res, 400, "OTP must be 6 digits");
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  }).select("+emailOtpHash +emailOtpExpires");

  if (!customer) {
    return apiResponse(res, 404, "Account not found");
  }

  if (customer.isEmailVerified) {
    return apiResponse(res, 200, "Email already verified");
  }

  if (
    !customer.emailOtpHash ||
    !customer.emailOtpExpires ||
    customer.emailOtpExpires.getTime() <= Date.now()
  ) {
    return apiResponse(
      res,
      400,
      "OTP expired. Please request a new OTP."
    );
  }

  const correct = await bcrypt.compare(
    otp.trim(),
    customer.emailOtpHash
  );

  if (!correct) {
    return apiResponse(res, 400, "Invalid OTP");
  }

  customer.isEmailVerified = true;
  customer.emailOtpHash = undefined;
  customer.emailOtpExpires = undefined;

  await customer.save();

  return apiResponse(res, 200, "Email verified successfully");
});

// ======================================================
// RESEND REGISTRATION OTP
// ======================================================

export const resendEmailOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (typeof email !== "string" || !email.trim()) {
    return apiResponse(res, 400, "Email is required");
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  }).select("+emailOtpHash +emailOtpExpires");

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
    // Matches your original resendEmailOtp call signature.
    await sendOtpEmail(customer.email, otp, "verify");
  } catch (error) {
    console.error("Resend email OTP failed:", error.message);

    customer.emailOtpHash = undefined;
    customer.emailOtpExpires = undefined;
    await customer.save();

    return apiResponse(res, 502, "Could not send OTP email");
  }

  return apiResponse(
    res,
    200,
    "A new verification OTP has been sent"
  );
});

// ======================================================
// LOGIN: PASSWORD + SEND OTP
// Admin and Customer use the SAME login endpoint.
// ======================================================

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

  if (!customer) {
    return apiResponse(res, 401, "Invalid email or password");
  }

  const passwordCorrect = await bcrypt.compare(
    password,
    customer.password
  );

  if (!passwordCorrect) {
    return apiResponse(res, 401, "Invalid email or password");
  }

  if (!customer.isActive) {
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
    // Matches your original loginEmail call signature.
    await sendOtpEmail(customer.email, otp, "login");
  } catch (error) {
    console.error("Login OTP email failed:", error.message);

    customer.loginOtpHash = undefined;
    customer.loginOtpExpires = undefined;
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

// ======================================================
// VERIFY LOGIN OTP + ISSUE JWT
// ======================================================

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

  if (!/^\d{6}$/.test(otp.trim())) {
    return apiResponse(res, 400, "OTP must be 6 digits");
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  }).select(
    "+loginOtpHash +loginOtpExpires +loginOtpAttempts"
  );

  if (!customer) {
    return apiResponse(res, 404, "Account not found");
  }

  if (!customer.isActive || !customer.isEmailVerified) {
    return apiResponse(
      res,
      403,
      "Account is not eligible to log in"
    );
  }

  if (
    !customer.loginOtpHash ||
    !customer.loginOtpExpires ||
    customer.loginOtpExpires.getTime() <= Date.now()
  ) {
    return apiResponse(
      res,
      400,
      "Login OTP expired. Please log in again."
    );
  }

  if (
    (customer.loginOtpAttempts || 0) >=
    MAX_LOGIN_OTP_ATTEMPTS
  ) {
    customer.loginOtpHash = undefined;
    customer.loginOtpExpires = undefined;
    customer.loginOtpAttempts = 0;

    await customer.save();

    return apiResponse(
      res,
      429,
      "Too many incorrect OTP attempts. Please log in again."
    );
  }

  const correct = await bcrypt.compare(
    otp.trim(),
    customer.loginOtpHash
  );

  if (!correct) {
    customer.loginOtpAttempts =
      (customer.loginOtpAttempts || 0) + 1;

    if (
      customer.loginOtpAttempts >= MAX_LOGIN_OTP_ATTEMPTS
    ) {
      customer.loginOtpHash = undefined;
      customer.loginOtpExpires = undefined;
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

  // Role comes from the database, not req.body.
  const token = jwt.sign(
    {
      id: customer._id.toString(),
      role: customer.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "7d" }
  );

  customer.loginOtpHash = undefined;
  customer.loginOtpExpires = undefined;
  customer.loginOtpAttempts = 0;

  await customer.save();

  return apiResponse(res, 200, "Login successful", {
    user: sanitizeCustomer(customer),
    token,
  });
});

// ======================================================
// MY PROFILE
// ======================================================

export const getMyProfile = asyncHandler(async (req, res) => {
  return apiResponse(
    res,
    200,
    "Profile fetched successfully",
    sanitizeCustomer(req.user)
  );
});

// ======================================================
// GET ALL CUSTOMERS
// Search, status filter and pagination.
// Protect this route with verifyToken + authorizeRoles("admin").
// ======================================================

export const getAllCustomers = asyncHandler(async (req, res) => {
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
  const role = String(req.query.role || "all");

  const filter = {};

  if (search) {
    const escaped = search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const regex = new RegExp(escaped, "i");

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
  } else if (status !== "all") {
    return apiResponse(res, 400, "Invalid status filter");
  }

  if (role !== "all") {
    if (!ALLOWED_ROLES.includes(role)) {
      return apiResponse(res, 400, "Invalid role filter");
    }

    filter.role = role;
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

  return res.status(200).json({
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
  });
});

// ======================================================
// GET CUSTOMER BY ID
// ======================================================

export const getCustomerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!validObjectId(id)) {
    return apiResponse(res, 400, "Invalid customer ID");
  }

  const customer = await Customer.findById(id)
    .select(
      "_id name email phone address role isActive isEmailVerified createdAt updatedAt"
    )
    .lean();

  if (!customer) {
    return apiResponse(res, 404, "Customer not found");
  }

  return apiResponse(
    res,
    200,
    "Customer details fetched successfully",
    customer
  );
});

// ======================================================
// UPDATE CUSTOMER ROLE
// Only an authenticated ADMIN may call this controller.
// Never allow an admin to change their own role here.
// Existing admin accounts cannot be demoted through this API.
// ======================================================

export const updateCustomerRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!validObjectId(id)) {
    return apiResponse(res, 400, "Invalid customer ID");
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return apiResponse(res, 400, "Invalid role");
  }

  const actorId = req.user?._id?.toString();

  if (actorId && actorId === id) {
    return apiResponse(
      res,
      403,
      "You cannot change your own role"
    );
  }

  const customer = await Customer.findById(id);

  if (!customer) {
    return apiResponse(res, 404, "Customer not found");
  }

  if (customer.role === "admin" && role !== "admin") {
    return apiResponse(
      res,
      403,
      "An admin account cannot be demoted here"
    );
  }

  customer.role = role;
  await customer.save();

  return apiResponse(
    res,
    200,
    "Customer role updated successfully",
    {
      _id: customer._id,
      name: customer.name,
      email: customer.email,
      role: customer.role,
    }
  );
});

// ======================================================
// BLOCK / UNBLOCK CUSTOMER
// ======================================================

export const updateCustomerStatus = asyncHandler(
  async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!validObjectId(id)) {
      return apiResponse(res, 400, "Invalid customer ID");
    }

    if (typeof isActive !== "boolean") {
      return apiResponse(
        res,
        400,
        "isActive must be true or false"
      );
    }

    if (req.user?._id?.toString() === id && !isActive) {
      return apiResponse(
        res,
        403,
        "You cannot deactivate your own account here"
      );
    }

    const customer = await Customer.findById(id);

    if (!customer) {
      return apiResponse(res, 404, "Customer not found");
    }

    if (customer.role === "admin") {
      return apiResponse(
        res,
        403,
        "Admin accounts cannot be blocked here"
      );
    }

    customer.isActive = isActive;
    await customer.save();

    return apiResponse(
      res,
      200,
      isActive
        ? "Customer unblocked successfully"
        : "Customer blocked successfully",
      {
        _id: customer._id,
        name: customer.name,
        role: customer.role,
        isActive: customer.isActive,
      }
    );
  }
);

// ======================================================
// DELETE CUSTOMER
// ======================================================

export const deleteCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!validObjectId(id)) {
    return apiResponse(res, 400, "Invalid customer ID");
  }

  if (req.user?._id?.toString() === id) {
    return apiResponse(
      res,
      403,
      "You cannot delete your own account here"
    );
  }

  const customer = await Customer.findById(id);

  if (!customer) {
    return apiResponse(res, 404, "Customer not found");
  }

  if (customer.role === "admin") {
    return apiResponse(
      res,
      403,
      "Admin accounts cannot be deleted here"
    );
  }

  await Customer.deleteOne({ _id: customer._id });

  return apiResponse(res, 200, "Customer deleted successfully", {
    _id: customer._id,
  });
});
