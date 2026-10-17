
import jwt from "jsonwebtoken";
import Customer from "../Model/Customer.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/ApiResponse.js";

export const verifyToken = asyncHandler(async (req, res, next) => {
  // 1. Read token from cookie or Authorization header
  const authHeader = req.headers.authorization;

  const token =
    req.cookies?.accessToken ||
    (authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null);

  // 2. Check token exists
  if (!token) {
    return apiResponse(
      res,
      401,
      "Access denied. Please login."
    );
  }

  // 3. Verify JWT
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  let decoded;

  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );
  } catch {
    return apiResponse(
      res,
      401,
      "Invalid or expired token"
    );
  }

  // 4. Validate decoded user ID
  if (!decoded?.id) {
    return apiResponse(
      res,
      401,
      "Invalid authentication token"
    );
  }

  // 5. Find user in database
  const customer = await Customer.findById(decoded.id);

  if (!customer) {
    return apiResponse(
      res,
      401,
      "User not found"
    );
  }

  // 6. Check account status
  if (customer.isActive === false) {
    return apiResponse(
      res,
      403,
      "Your account is inactive"
    );
  }

  // 7. Attach authenticated user
  req.user = customer;

  return next();
});
