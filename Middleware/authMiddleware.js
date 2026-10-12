
import jwt from "jsonwebtoken";
import Customer from "../Model/Customer.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/ApiResponse.js";

export const verifyToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return apiResponse(res, 401, "Access denied. Please login.");
  }

  const token = authHeader.split(" ")[1];

  // Verify JWT
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (error) {
    return apiResponse(res, 401, "Invalid or expired token");
  }

  // Find user in database
  const customer = await Customer.findById(decoded.id);

  if (!customer) {
    return apiResponse(res, 401, "User not found");
  }

  if (customer.isActive === false) {
    return apiResponse(res, 403, "Your account is inactive");
  }

  // Attach user to request
  req.user = customer;

  next();
});
