

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import Customer from "../Model/Customer.js";
import { apiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOtpEmail } from "../Service/SendOtpHandler.js";

import {
  setLoginOtpTtl,
  hasLoginOtpTtl,
  deleteLoginOtpTtl,
} from "../utils/startOtpCleanup.js";

import { randomInt } from "crypto";

// ========================================
// CONFIGURATION
// ========================================

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const ADMIN_ROLES = ["admin", "subadmin"];

const normalizeEmail = (email = "") =>
  email.trim().toLowerCase();

const generateOtp = () =>
  randomInt(100000, 1000000).toString();

const sanitizeAdmin = (admin) => {
  if (!admin) return null;

  const data =
    typeof admin.toObject === "function"
      ? admin.toObject()
      : { ...admin };

  delete data.password;
  delete data.loginOtpHash;
  delete data.loginOtpExpires;
  delete data.loginOtpAttempts;
  delete data.emailOtpHash;
  delete data.emailOtpExpires;

  return data;
};

// ========================================
// 1. ADMIN LOGIN
// POST /api/admin-auth/login
// Body: { email, password }
// ========================================

export const adminLogin = asyncHandler(async (req, res) => {
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

  // Find admin directly from Customer Schema.
  const admin = await Customer.findOne({
    email: normalizeEmail(email),
  }).select("+password");

  if (!admin || !admin.password) {
    return apiResponse(
      res,
      401,
      "Invalid email or password"
    );
  }

  // Check password.
  const passwordCorrect = await bcrypt.compare(
    password,
    admin.password
  );

  if (!passwordCorrect) {
    return apiResponse(
      res,
      401,
      "Invalid email or password"
    );
  }

  // Only admin and subadmin can use this login.
  if (!ADMIN_ROLES.includes(admin.role)) {
    return apiResponse(
      res,
      403,
      "You are not authorized to access the admin panel"
    );
  }

  // Check account status.
  if (admin.isActive === false) {
    return apiResponse(
      res,
      403,
      "Your admin account is inactive"
    );
  }

  // Check email verification.
  if (!admin.isEmailVerified) {
    return apiResponse(
      res,
      403,
      "Please verify your email before logging in"
    );
  }

  // Check required environment variable.
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  // Generate OTP.
  const otp = generateOtp();

  admin.loginOtpHash = await bcrypt.hash(otp, 10);
  admin.loginOtpExpires = new Date(
    Date.now() + OTP_EXPIRY_MS
  );
  admin.loginOtpAttempts = 0;

  await admin.save();

  // Store OTP expiry in Redis.
  try {
    await setLoginOtpTtl(admin._id.toString());
  } catch (error) {
    console.error("Admin OTP Redis error:", error);

    admin.loginOtpHash = null;
    admin.loginOtpExpires = null;
    admin.loginOtpAttempts = 0;

    await admin.save();

    return apiResponse(
      res,
      503,
      "OTP service is temporarily unavailable"
    );
  }

  // Send OTP to admin email.
  try {
    await sendOtpEmail(
      admin.email,
      otp,
      admin.name,
      "login"
    );
  } catch (error) {
    console.error("Admin login OTP email error:", error);

    await deleteLoginOtpTtl(
      admin._id.toString()
    ).catch(() => {});

    admin.loginOtpHash = null;
    admin.loginOtpExpires = null;
    admin.loginOtpAttempts = 0;

    await admin.save();

    return apiResponse(
      res,
      502,
      "Could not send admin login OTP"
    );
  }

  return apiResponse(
    res,
    200,
    "Admin login OTP sent to your email",
    {
      email: admin.email,
      requiresLoginOtp: true,
    }
  );
});

// ========================================
// 2. VERIFY ADMIN LOGIN OTP
// POST /api/admin-auth/verify-otp
// Body: { email, otp }
// ========================================

export const verifyAdminLoginOtp = asyncHandler(
  async (req, res) => {
    const { email, otp } = req.body;

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      !email.trim() ||
      !otp.trim()
    ) {
      return apiResponse(
        res,
        400,
        "Email and OTP are required"
      );
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      return apiResponse(
        res,
        400,
        "OTP must contain 6 digits"
      );
    }

    const admin = await Customer.findOne({
      email: normalizeEmail(email),
    }).select(
      "+loginOtpHash +loginOtpExpires +loginOtpAttempts"
    );

    if (!admin) {
      return apiResponse(
        res,
        404,
        "Admin account not found"
      );
    }

    // Recheck role and account status.
    if (!ADMIN_ROLES.includes(admin.role)) {
      return apiResponse(
        res,
        403,
        "Admin access denied"
      );
    }

    if (
      admin.isActive === false ||
      !admin.isEmailVerified
    ) {
      return apiResponse(
        res,
        403,
        "Admin account is inactive or email is unverified"
      );
    }

    // Check Redis expiry.
    let redisOtpActive;

    try {
      redisOtpActive = await hasLoginOtpTtl(
        admin._id.toString()
      );
    } catch (error) {
      console.error("Admin OTP Redis check error:", error);

      return apiResponse(
        res,
        503,
        "OTP service is temporarily unavailable"
      );
    }

    const expired =
      !redisOtpActive ||
      !admin.loginOtpHash ||
      !admin.loginOtpExpires ||
      new Date(admin.loginOtpExpires).getTime() <=
        Date.now();

    if (expired) {
      admin.loginOtpHash = null;
      admin.loginOtpExpires = null;
      admin.loginOtpAttempts = 0;

      await admin.save();

      await deleteLoginOtpTtl(
        admin._id.toString()
      ).catch(() => {});

      return apiResponse(
        res,
        400,
        "OTP expired. Please log in again"
      );
    }

    // Limit incorrect attempts.
    if (
      (admin.loginOtpAttempts || 0) >=
      MAX_OTP_ATTEMPTS
    ) {
      admin.loginOtpHash = null;
      admin.loginOtpExpires = null;
      admin.loginOtpAttempts = 0;

      await admin.save();

      await deleteLoginOtpTtl(
        admin._id.toString()
      ).catch(() => {});

      return apiResponse(
        res,
        429,
        "Too many incorrect OTP attempts. Please log in again"
      );
    }

    // Verify OTP.
    const correctOtp = await bcrypt.compare(
      otp.trim(),
      admin.loginOtpHash
    );

    if (!correctOtp) {
      admin.loginOtpAttempts =
        (admin.loginOtpAttempts || 0) + 1;

      // Remove OTP after the fifth incorrect attempt.
      if (
        admin.loginOtpAttempts >= MAX_OTP_ATTEMPTS
      ) {
        admin.loginOtpHash = null;
        admin.loginOtpExpires = null;
        admin.loginOtpAttempts = 0;

        await admin.save();

        await deleteLoginOtpTtl(
          admin._id.toString()
        ).catch(() => {});

        return apiResponse(
          res,
          429,
          "Too many incorrect OTP attempts. Please log in again"
        );
      }

      await admin.save();

      return apiResponse(
        res,
        400,
        "Invalid OTP",
        {
          attemptsRemaining:
            MAX_OTP_ATTEMPTS -
            admin.loginOtpAttempts,
        }
      );
    }

    // Confirm JWT configuration.
    if (!process.env.JWT_ACCESS_SECRET) {
      throw new Error("JWT_ACCESS_SECRET is missing");
    }

    // Generate JWT.
    const token = jwt.sign(
      {
        id: admin._id.toString(),
        role: admin.role,
      },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Clear OTP after successful verification.
    admin.loginOtpHash = null;
    admin.loginOtpExpires = null;
    admin.loginOtpAttempts = 0;

    await admin.save();

    await deleteLoginOtpTtl(
      admin._id.toString()
    ).catch(() => {});

    return apiResponse(
      res,
      200,
      "Admin login successful",
      {
        user: sanitizeAdmin(admin),
        token,
      }
    );
  }
);

// ========================================
// 3. GET LOGGED-IN ADMIN PROFILE
// GET /api/admin-auth/me
// Requires verifyToken + authorizeRoles
// ========================================

export const getAdminProfile = asyncHandler(
  async (req, res) => {
    if (!req.user) {
      return apiResponse(
        res,
        401,
        "Authentication required"
      );
    }

    if (!ADMIN_ROLES.includes(req.user.role)) {
      return apiResponse(
        res,
        403,
        "Admin access denied"
      );
    }

    return apiResponse(
      res,
      200,
      "Admin profile fetched successfully",
      {
        user: sanitizeAdmin(req.user),
      }
    );
  }
);
