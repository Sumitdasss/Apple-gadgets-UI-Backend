
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt } from "crypto";

import Customer from "../Model/Customer.js";
import { apiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOtpEmail } from "../Service/SendOtpHandler.js";

const OTP_EXPIRY_MS = 5 * 60 * 1000;

const generateOtp = () =>
  randomInt(100000, 1000000).toString();

const createOtpExpiry = () =>
  new Date(Date.now() + OTP_EXPIRY_MS);

// ================= REGISTER =================
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, address, phone } = req.body;

  if (
    !name?.trim() ||
    !email?.trim() ||
    !password ||
    !address?.trim() ||
    !phone?.trim()
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

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  const existingUser = await Customer.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    return apiResponse(res, 409, "Email already registered");
  }

  const existingPhone = await Customer.findOne({
    phone: normalizedPhone,
  });

  if (existingPhone) {
    return apiResponse(res, 409, "Phone number already registered");
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);

  const customer = await Customer.create({
    name: name.trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 10),
    address: address.trim(),
    phone: normalizedPhone,
    isEmailVerified: false,
    emailOtpHash: otpHash,
    emailOtpExpires: createOtpExpiry(),
  });

  try {
    await sendOtpEmail(normalizedEmail, otp, name, "verify");
  } catch (error) {
    // Keep the account unverified. Never return the OTP.
    console.error("Registration OTP email failed:", error.message);

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
    { email: customer.email, requiresEmailVerification: true }
  );
});

// ================= VERIFY REGISTRATION EMAIL OTP =================
export const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email?.trim() || !otp?.trim()) {
    return apiResponse(res, 400, "Email and OTP are required");
  }

  const customer = await Customer.findOne({
    email: email.trim().toLowerCase(),
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

  const isCorrect = await bcrypt.compare(
    otp.trim(),
    customer.emailOtpHash
  );

  if (!isCorrect) {
    return apiResponse(res, 400, "Invalid OTP");
  }

  customer.isEmailVerified = true;
  customer.emailOtpHash = undefined;
  customer.emailOtpExpires = undefined;

  await customer.save();

  return apiResponse(res, 200, "Email verified successfully");
});

// ================= RESEND REGISTRATION OTP =================
export const resendEmailOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email?.trim()) {
    return apiResponse(res, 400, "Email is required");
  }

  const customer = await Customer.findOne({
    email: email.trim().toLowerCase(),
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
    await sendOtpEmail(customer.email, otp, "verify");
  } catch (error) {
    console.error("Resend email OTP failed:", error.message);

    customer.emailOtpHash = undefined;
    customer.emailOtpExpires = undefined;
    await customer.save();

    return apiResponse(res, 502, "Could not send OTP email");
  }

  return apiResponse(res, 200, "A new verification OTP has been sent");
});

// ================= LOGIN: PASSWORD + SEND OTP =================
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return apiResponse(
      res,
      400,
      "Email and password are required"
    );
  }

  const customer = await Customer.findOne({
    email: email.trim().toLowerCase(),
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
    await sendOtpEmail(customer.email, otp, "login");
  } catch (error) {
    console.error("Login OTP email failed:", error.message);

    customer.loginOtpHash = undefined;
    customer.loginOtpExpires = undefined;
    customer.loginOtpAttempts = 0;
    await customer.save();

    return apiResponse(res, 502, "Could not send login OTP");
  }

  // Do not return a JWT before the OTP is verified.
  return apiResponse(
    res,
    200,
    "Login OTP sent to your email",
    { email: customer.email, requiresLoginOtp: true }
  );
});

// ================= VERIFY LOGIN OTP + ISSUE JWT =================
export const verifyLoginOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email?.trim() || !otp?.trim()) {
    return apiResponse(res, 400, "Email and OTP are required");
  }

  const customer = await Customer.findOne({
    email: email.trim().toLowerCase(),
  }).select("+loginOtpHash +loginOtpExpires +loginOtpAttempts");

  if (!customer) {
    return apiResponse(res, 404, "Account not found");
  }

  if (!customer.isActive || !customer.isEmailVerified) {
    return apiResponse(res, 403, "Account is not eligible to log in");
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

  if ((customer.loginOtpAttempts || 0) >= 5) {
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

  const isCorrect = await bcrypt.compare(
    otp.trim(),
    customer.loginOtpHash
  );

  if (!isCorrect) {
    customer.loginOtpAttempts =
      (customer.loginOtpAttempts || 0) + 1;

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

  // OTP must not be reusable.
  customer.loginOtpHash = undefined;
  customer.loginOtpExpires = undefined;
  customer.loginOtpAttempts = 0;

  await customer.save();

  const user = customer.toObject();

  delete user.password;
  delete user.emailOtpHash;
  delete user.emailOtpExpires;
  delete user.loginOtpHash;
  delete user.loginOtpExpires;
  delete user.loginOtpAttempts;

  return apiResponse(res, 200, "Login successful", {
    user,
    token,
  });
});

// ================= MY PROFILE =================
export const getMyProfile = asyncHandler(async (req, res) => {
  const user = req.user.toObject();

  delete user.password;
  delete user.emailOtpHash;
  delete user.emailOtpExpires;
  delete user.loginOtpHash;
  delete user.loginOtpExpires;
  delete user.loginOtpAttempts;

  return apiResponse(
    res,
    200,
    "Profile fetched successfully",
    user
  );
});
