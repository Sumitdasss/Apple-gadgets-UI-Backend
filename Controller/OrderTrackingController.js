
import mongoose from "mongoose";
import MainOrder from "../Model/MainOrder.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/ApiResponse.js";

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (req) =>
  req.user?._id || req.user?.id || null;

const normalizeOrderId = (value = "") =>
  String(value).trim();

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

const getSafeTrackingData = (order) => ({
  orderId: order.orderId,
  status: order.status,
  deliveryStatus: order.deliveryStatus,
  deliveryMethod: order.deliveryMethod,
  courierDetails: {
    provider: order.courierDetails?.provider || "",
    trackingCode: order.courierDetails?.trackingCode || "",
    consignmentId: order.courierDetails?.consignmentId || "",
    courierStatus: order.courierDetails?.courierStatus || "",
  },
  deliveryNote: order.deliveryNote || "",
  deliveryHistory: (order.deliveryHistory || []).map((item) => ({
    status: item.status,
    note: item.note || "",
    updatedAt: item.updatedAt,
  })),
  statusHistory: (order.statusHistory || []).map((item) => ({
    status: item.status,
    note: item.note || "",
    updatedAt: item.updatedAt,
  })),
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

/* =========================================================
   GET ORDER TRACKING BY ORDER ID
   GET /api/tracking/:orderId

   Requires login.
   Customer can see only their own order.
   Admin can see any order.
   Employee can see only orders assigned to them.
========================================================= */

export const getOrderTracking = asyncHandler(
  async (req, res) => {
    const orderId = normalizeOrderId(req.params.orderId);

    if (!orderId) {
      return apiResponse(res, 400, "Order ID is required");
    }

    const userId = getUserId(req);

    if (!userId) {
      return apiResponse(res, 401, "Please login first");
    }

    const userRole = String(req.user?.role || "")
      .toLowerCase()
      .trim();

    let order = await MainOrder.findOne({ orderId })
      .select(
        [
          "orderId",
          "customer",
          "status",
          "deliveryStatus",
          "deliveryMethod",
          "courierDetails",
          "deliveryNote",
          "deliveryHistory",
          "statusHistory",
          "assignedEmployee",
          "createdAt",
          "updatedAt",
        ].join(" ")
      )
      .lean();

    // Also support MongoDB document ID.
    if (!order && isValidObjectId(orderId)) {
      order = await MainOrder.findById(orderId)
        .select(
          [
            "orderId",
            "customer",
            "status",
            "deliveryStatus",
            "deliveryMethod",
            "courierDetails",
            "deliveryNote",
            "deliveryHistory",
            "statusHistory",
            "assignedEmployee",
            "createdAt",
            "updatedAt",
          ].join(" ")
        )
        .lean();
    }

    if (!order) {
      return apiResponse(res, 404, "Order not found");
    }

    const isAdmin = [
      "admin",
      "subadmin",
    ].includes(userRole);

    const isOwner =
      String(order.customer) === String(userId);

    const isAssignedEmployee =
      String(order.assignedEmployee || "") === String(userId);

    if (
      !isAdmin &&
      !isOwner &&
      !isAssignedEmployee
    ) {
      return apiResponse(
        res,
        403,
        "You are not allowed to view this order"
      );
    }

    return apiResponse(
      res,
      200,
      "Order tracking fetched successfully",
      getSafeTrackingData(order)
    );
  }
);

/* =========================================================
   GET MY ORDERS BY AUTHENTICATED CUSTOMER PHONE
   GET /api/tracking/my-orders

   Requires login.
   Uses the authenticated user's phone number,
   not an arbitrary phone number from the request.
========================================================= */

export const getCustomerOrdersByPhone = asyncHandler(
  async (req, res) => {
    const userId = getUserId(req);

    if (!userId) {
      return apiResponse(res, 401, "Please login first");
    }

    const phone = String(req.user?.phone || "").trim();

    if (!phone) {
      return apiResponse(
        res,
        400,
        "Phone number is not available on your account"
      );
    }

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(req.query.limit, 10) || 10
      )
    );

    const filter = {
      customer: userId,
      phone,
    };

    const [orders, total] = await Promise.all([
      MainOrder.find(filter)
        .select(
          [
            "orderId",
            "status",
            "deliveryStatus",
            "deliveryMethod",
            "courierDetails.provider",
            "courierDetails.trackingCode",
            "courierDetails.consignmentId",
            "courierDetails.courierStatus",
            "deliveryNote",
            "deliveryHistory",
            "statusHistory",
            "totalAmount",
            "paymentStatus",
            "createdAt",
            "updatedAt",
          ].join(" ")
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      MainOrder.countDocuments(filter),
    ]);

    return apiResponse(
      res,
      200,
      "Your orders fetched successfully",
      {
        orders: orders.map(getSafeTrackingData),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    );
  }
);

/* =========================================================
   GET MY ORDER TRACKING
   GET /api/tracking/my-order/:orderId

   Requires login.
   Only the authenticated order owner can access it.
========================================================= */

export const getMyOrderTracking = asyncHandler(
  async (req, res) => {
    const orderId = normalizeOrderId(req.params.orderId);
    const userId = getUserId(req);

    if (!userId) {
      return apiResponse(res, 401, "Please login first");
    }

    if (!orderId) {
      return apiResponse(res, 400, "Order ID is required");
    }

    let order = await MainOrder.findOne({
      orderId,
      customer: userId,
    })
      .select(
        [
          "orderId",
          "customer",
          "status",
          "deliveryStatus",
          "deliveryMethod",
          "courierDetails",
          "deliveryNote",
          "deliveryHistory",
          "statusHistory",
          "createdAt",
          "updatedAt",
        ].join(" ")
      )
      .lean();

    if (!order && isValidObjectId(orderId)) {
      order = await MainOrder.findOne({
        _id: orderId,
        customer: userId,
      })
        .select(
          [
            "orderId",
            "customer",
            "status",
            "deliveryStatus",
            "deliveryMethod",
            "courierDetails",
            "deliveryNote",
            "deliveryHistory",
            "statusHistory",
            "createdAt",
            "updatedAt",
          ].join(" ")
        )
        .lean();
    }

    if (!order) {
      return apiResponse(
        res,
        404,
        "Order not found for your account"
      );
    }

    return apiResponse(
      res,
      200,
      "Your order tracking fetched successfully",
      getSafeTrackingData(order)
    );
  }
);
