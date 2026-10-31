import bcrypt from "bcryptjs";
import crypto, { randomInt } from "crypto";

import Customer from "../Model/Customer.js";
import { apiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOtpEmail } from "../Service/SendOtpHandler.js";

// =====================================================
// CONFIG
// =====================================================

const RESET_OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESET_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_RESET_OTP_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 6;

// Same reply whether the account exists or not (prevents email enumeration)
const GENERIC_FORGOT_MESSAGE =
  "If an account exists for this email, a password reset code has been sent.";

// =====================================================
// HELPERS
// =====================================================

const generateOtp = () => randomInt(100000, 1000000).toString();

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const safeEqual = (a, b) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

const clearResetOtp = (customer) => {
  customer.resetOtpHash = undefined;
  customer.resetOtpExpires = undefined;
  customer.resetOtpAttempts = 0;
};

const clearResetToken = (customer) => {
  customer.resetTokenHash = undefined;
  customer.resetTokenExpires = undefined;
};

// =====================================================
// STEP 1: FORGOT PASSWORD  ->  send OTP to email
// POST /api/users/forgot-password
// Body: { email }
// Also used for "Resend code".
// =====================================================

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (typeof email !== "string" || !email.trim()) {
    return apiResponse(res, 400, "Email is required");
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  }).select("+resetOtpSentAt");

  // Unknown / unverified / blocked accounts: same generic reply, no email sent
  if (
    !customer ||
    !customer.isEmailVerified ||
    customer.isActive === false
  ) {
    return apiResponse(res, 200, GENERIC_FORGOT_MESSAGE);
  }

  // Resend cooldown (silent, keeps the reply identical)
  if (
    customer.resetOtpSentAt &&
    Date.now() - new Date(customer.resetOtpSentAt).getTime() <
      RESEND_COOLDOWN_MS
  ) {
    return apiResponse(res, 200, GENERIC_FORGOT_MESSAGE);
  }

  const otp = generateOtp();

  customer.resetOtpHash = await bcrypt.hash(otp, 10);
  customer.resetOtpExpires = new Date(Date.now() + RESET_OTP_EXPIRY_MS);
  customer.resetOtpAttempts = 0;
  customer.resetOtpSentAt = new Date();
  clearResetToken(customer); // any older reset token becomes invalid

  await customer.save();

  try {
    // NOTE: SendOtpHandler must support the "reset" type (see instructions)
    await sendOtpEmail(customer.email, otp, customer.name, "reset");
  } catch (error) {
    console.error("Password reset OTP email failed:", error);

    clearResetOtp(customer);
    customer.resetOtpSentAt = undefined;
    await customer.save();

    return apiResponse(
      res,
      502,
      "Could not send the reset code. Please try again."
    );
  }

  return apiResponse(res, 200, GENERIC_FORGOT_MESSAGE);
});

// =====================================================
// STEP 2: VERIFY RESET OTP  ->  returns one-time resetToken
// POST /api/users/verify-reset-otp
// Body: { email, otp }
// =====================================================

export const verifyResetOtp = asyncHandler(async (req, res) => {
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
    return apiResponse(res, 400, "OTP must contain 6 digits");
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  }).select("+resetOtpHash +resetOtpExpires +resetOtpAttempts");

  if (!customer || !customer.resetOtpHash) {
    return apiResponse(res, 400, "Invalid or expired code");
  }

  // Expired
  if (
    !customer.resetOtpExpires ||
    new Date(customer.resetOtpExpires).getTime() <= Date.now()
  ) {
    clearResetOtp(customer);
    await customer.save();

    return apiResponse(
      res,
      400,
      "Code expired. Please request a new one."
    );
  }

  // Too many wrong tries
  if ((customer.resetOtpAttempts || 0) >= MAX_RESET_OTP_ATTEMPTS) {
    clearResetOtp(customer);
    await customer.save();

    return apiResponse(
      res,
      429,
      "Too many incorrect attempts. Please request a new code."
    );
  }

  const isCorrect = await bcrypt.compare(
    otp.trim(),
    customer.resetOtpHash
  );

  if (!isCorrect) {
    customer.resetOtpAttempts = (customer.resetOtpAttempts || 0) + 1;
    await customer.save();

    return apiResponse(res, 400, "Invalid or expired code");
  }

  // OTP correct -> issue a single-use reset token (only its hash is stored)
  const resetToken = crypto.randomBytes(32).toString("hex");

  customer.resetTokenHash = sha256(resetToken);
  customer.resetTokenExpires = new Date(
    Date.now() + RESET_TOKEN_EXPIRY_MS
  );
  clearResetOtp(customer); // OTP cannot be reused

  await customer.save();

  return apiResponse(res, 200, "Code verified. You can now set a new password.", {
    email: customer.email,
    resetToken,
  });
});

// =====================================================
// STEP 3: RESET PASSWORD
// POST /api/users/reset-password
// Body: { email, resetToken, newPassword }
// =====================================================

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, resetToken, newPassword } = req.body;

  if (
    typeof email !== "string" ||
    typeof resetToken !== "string" ||
    typeof newPassword !== "string" ||
    !email.trim() ||
    !resetToken ||
    !newPassword
  ) {
    return apiResponse(
      res,
      400,
      "Email, reset token and new password are required"
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return apiResponse(
      res,
      400,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }

  const customer = await Customer.findOne({
    email: normalizeEmail(email),
  }).select("+password +resetTokenHash +resetTokenExpires");

  if (
    !customer ||
    !customer.resetTokenHash ||
    !customer.resetTokenExpires ||
    new Date(customer.resetTokenExpires).getTime() <= Date.now() ||
    !safeEqual(sha256(resetToken), customer.resetTokenHash)
  ) {
    return apiResponse(
      res,
      400,
      "Reset session is invalid or expired. Please start again."
    );
  }

  if (customer.password) {
    const samePassword = await bcrypt.compare(
      newPassword,
      customer.password
    );

    if (samePassword) {
      return apiResponse(
        res,
        400,
        "New password must be different from your old password"
      );
    }
  }

  customer.password = await bcrypt.hash(newPassword, 10);
  customer.passwordChangedAt = new Date();

  // Clear every reset / login OTP leftover
  clearResetToken(customer);
  clearResetOtp(customer);
  customer.resetOtpSentAt = undefined;
  customer.loginOtpHash = undefined;
  customer.loginOtpExpires = undefined;
  customer.loginOtpAttempts = 0;

  await customer.save();

  return apiResponse(
    res,
    200,
    "Password reset successful. Please log in with your new password."
  );
});