
import { apiResponse } from "../utils/ApiResponse.js";

export const authorizeRoles = (...roles) => {
  // Normalize permitted roles
  const allowedRoles = roles.map((role) =>
    String(role).toLowerCase().trim()
  );

  return (req, res, next) => {
    if (!req.user) {
      return apiResponse(res, 401, "Please login first");
    }

    const userRole = String(req.user.role || "")
      .toLowerCase()
      .trim();

    if (!allowedRoles.includes(userRole)) {
      return apiResponse(
        res,
        403,
        "You are not authorized to perform this action"
      );
    }

    return next();
  };
};
