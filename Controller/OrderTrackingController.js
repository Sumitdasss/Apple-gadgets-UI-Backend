
import mongoose from "mongoose";
import MainOrder from "../Model/MainOrder.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/ApiResponse.js";

/* =====================================================
   HELPERS
===================================================== */

const getUserId = (req) =>
  req.user?._id || req.user?.id || null;

const getUserRole = (req) =>
  String(req.user?.role || "").toLowerCase();

const normalizeOrderId = (value = "") =>
  String(value).trim();

const isValidObjectId = (value) =>
  mongoose.isValidObjectId(value);

const isStaffRole = (role) =>
  ["admin", "subadmin", "employee", "order_manager"].includes(role);

const getProductImage = (product) => {
  if (!product) return "";

  if (typeof product.image === "string" && product.image.trim()) {
    return product.image;
  }

  if (typeof product.productImage === "string" && product.productImage.trim()) {
    return product.productImage;
  }

  if (Array.isArray(product.images) && product.images.length > 0) {
    const firstImage = product.images[0];

    if (typeof firstImage === "string") return firstImage;

    if (firstImage?.url) return firstImage.url;
  }

  if (Array.isArray(product.colorImages) && product.colorImages.length > 0) {
    const firstImage = product.colorImages[0];

    if (typeof firstImage === "string") return firstImage;

    if (firstImage?.url) return firstImage.url;
  }

  return "";
};

/**
 * Order-এর product information normalize করে।
 * Schema-তে যে field আছে তার পাশাপাশি legacy field-ও handle করে।
 */
const getSafeProductData = (product) => {
  if (!product) return null;

  return {
    _id: product._id || null,
    product: product.product || product.productId || null,
    productId: product.productId || product.product || null,
    name:
      product.name ||
      product.productName ||
      product.title ||
      "",
    image: getProductImage(product),
    quantity: Math.max(1, Number(product.quantity) || 1),
    price: Number(product.price ?? product.salePrice ?? 0),
    color: product.color || product.selectedColor || "",
    ram: product.ram || product.selectedRam || "",
    storage: product.storage || product.selectedStorage || "",
    sku: product.sku || "",
  };
};

/**
 * API response-এ order-এর প্রয়োজনীয় safe data পাঠায়।
 * Products বাদ না দিয়ে name, image, quantity-সহ return করে।
 */
const getSafeTrackingData = (order) => ({
  _id: order._id,
  orderId: order.orderId || "",
  customer: order.customer || null,
  customerName: order.customerName || "",
  phone: order.phone || "",
  email: order.email || "",

  products: Array.isArray(order.products)
    ? order.products.map(getSafeProductData).filter(Boolean)
    : [],

  subtotal: Number(order.subtotal ?? 0),
  totalAmount: Number(order.totalAmount ?? 0),
  discount: Number(order.discount ?? 0),
  deliveryCharge: Number(order.deliveryCharge ?? 0),
  paymentMethod: order.paymentMethod || "",
  paymentStatus: order.paymentStatus || "",
  status: order.status || "",
  deliveryStatus: order.deliveryStatus || "",
  deliveryMethod: order.deliveryMethod || "",

  courierDetails: {
    provider: order.courierDetails?.provider || "",
    trackingCode: order.courierDetails?.trackingCode || "",
    consignmentId: order.courierDetails?.consignmentId || "",
    courierStatus: order.courierDetails?.courierStatus || "",
  },

  deliveryNote: order.deliveryNote || "",

  deliveryHistory: (order.deliveryHistory || []).map((item) => ({
    status: item.status || "",
    note: item.note || "",
    updatedAt: item.updatedAt || null,
  })),

  statusHistory: (order.statusHistory || []).map((item) => ({
    status: item.status || "",
    note: item.note || "",
    updatedAt: item.updatedAt || null,
  })),

  createdAt: order.createdAt || null,
  updatedAt: order.updatedAt || null,
});

/**
 * Tracking-এর জন্য প্রয়োজনীয় fields।
 * এখানে products অবশ্যই select করতে হবে।
 */
const TRACKING_SELECT = [
  "orderId",
  "customer",
  "customerName",
  "phone",
  "email",
  "products",
  "subtotal",
  "totalAmount",
  "discount",
  "deliveryCharge",
  "paymentMethod",
  "paymentStatus",
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
].join(" ");

/* =====================================================
   1. GET SINGLE ORDER TRACKING
   GET /products/Coustomer-orders/:orderId
===================================================== */

export const getOrderTracking = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  const orderId = normalizeOrderId(req.params.orderId);

  if (!userId || !isValidObjectId(userId)) {
    return apiResponse(res, 401, "Authentication required");
  }

  if (!orderId) {
    return apiResponse(res, 400, "Order ID is required");
  }

  let order = await MainOrder.findOne({ orderId })
    .select(TRACKING_SELECT)
    .lean();

  // MongoDB _id দিয়েও খোঁজার সুবিধা।
  if (!order && isValidObjectId(orderId)) {
    order = await MainOrder.findById(orderId)
      .select(TRACKING_SELECT)
      .lean();
  }

  if (!order) {
    return apiResponse(res, 404, "Order not found");
  }

  const isOwner =
    String(order.customer || "") === String(userId);

  const isAssignedEmployee =
    String(order.assignedEmployee || "") === String(userId);

  if (!isOwner && !isStaffRole(role) && !isAssignedEmployee) {
    return apiResponse(res, 403, "You are not allowed to view this order");
  }

  return apiResponse(
    res,
    200,
    "Order tracking fetched successfully",
    { order: getSafeTrackingData(order) }
  );
});

/* =====================================================
   2. GET CUSTOMER'S ORDERS
   GET /products/Coustomer-orders
===================================================== */

export const getCustomerOrdersByPhone = asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  if (!userId || !isValidObjectId(userId)) {
    return apiResponse(res, 401, "Authentication required");
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit, 10) || 10)
  );

  const skip = (page - 1) * limit;

  // Authenticated customer-এর order-ই দেখানো হবে।
  // শুধু phone-এর উপর নির্ভর করে অন্যের order প্রকাশ করা হবে না।
  const filter = { customer: userId };

  const [orders, totalOrders] = await Promise.all([
    MainOrder.find(filter)
      .select(TRACKING_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    MainOrder.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalOrders / limit);

  return apiResponse(
    res,
    200,
    "Your orders fetched successfully",
    {
      orders: orders.map(getSafeTrackingData),
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }
  );
});

/* =====================================================
   3. GET MY SINGLE ORDER TRACKING
   GET /products/orders/:orderId
===================================================== */

export const getMyOrderTracking = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const orderId = normalizeOrderId(req.params.orderId);

  if (!userId || !isValidObjectId(userId)) {
    return apiResponse(res, 401, "Authentication required");
  }

  if (!orderId) {
    return apiResponse(res, 400, "Order ID is required");
  }

  let order = await MainOrder.findOne({
    orderId,
    customer: userId,
  })
    .select(TRACKING_SELECT)
    .lean();

  if (!order && isValidObjectId(orderId)) {
    order = await MainOrder.findOne({
      _id: orderId,
      customer: userId,
    })
      .select(TRACKING_SELECT)
      .lean();
  }

  if (!order) {
    return apiResponse(
      res,
      404,
      "Order not found or you do not have permission to view it"
    );
  }

  return apiResponse(
    res,
    200,
    "Your order tracking fetched successfully",
    { order: getSafeTrackingData(order) }
  );
});
