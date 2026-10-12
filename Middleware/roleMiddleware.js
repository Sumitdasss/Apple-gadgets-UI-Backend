
import { apiResponse } from "../utils/ApiResponse.js";

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return apiResponse(res, 401, "Please login first");
    }

    if (!roles.includes(req.user.role)) {
      return apiResponse(
        res,
        403,
        "You are not authorized to perform this action"
      );
    }

    next();
  };
};
