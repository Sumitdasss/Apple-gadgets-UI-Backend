
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

  if (!token) {
    return apiResponse(res, 401, "Access denied. Please login.");
  }

  // 2. Check JWT secret
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    console.error("JWT_ACCESS_SECRET is missing");
    return apiResponse(res, 500, "Authentication configuration error");
  }

  // 3. Verify token
  let decoded;

  try {
    decoded = jwt.verify(token, secret);
  } catch (error) {
    return apiResponse(
      res,
      401,
      error.name === "TokenExpiredError"
        ? "Token expired. Please login again."
        : "Invalid token. Please login again."
    );
  }

  // 4. Support common JWT ID field names
  const userId = decoded?.id || decoded?._id || decoded?.userId;

  if (!userId) {
    return apiResponse(res, 401, "User ID missing from authentication token");
  }

  // 5. Find authenticated user
  const user = await Customer.findById(userId).select("-password");

  if (!user) {
    return apiResponse(res, 401, "User not found. Please login again.");
  }

  // 6. Check account status
  if (user.isActive === false) {
    return apiResponse(res, 403, "Your account is inactive");
  }

  // 7. Attach user to request
  req.user = user;

  return next();
});
