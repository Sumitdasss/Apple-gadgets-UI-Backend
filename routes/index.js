import express from "express";

import upload from "../midddlewere/upload.js";
import {
  addProduct,
  getAllProduct,
  getProductById,
  getProducts,
  updateProduct,
  deleteProduct
} from "../Controller/addproduct.js";
import {
  receiveWebhook,
  verifyWebhook,
} from "../Controller/messengerController.js";
import { checkFacebookToken } from "../Service/messengerController.js";
import {
  createMainCategory,
  createSubCategory,
  createChildCategory,
  createSubChildCategory,
  getFullCategoryTree,
  updateCategoryBanner,
} from "../Controller/Catgorihandelar.js";
import {  createOrder, getAllOrders, getOrderByOrderId, getOrderDetails, getOrderNavigation  } from "../Controller/CREATODER.js";
import { OderActivity } from "../Controller/ShowOderactivity.js";
import { getDashboardSummary } from "../Controller/Deshbord.js";
import { bulkUpdateOrders, deleteOrder, getOrders, updateOrder } from "../Controller/OrderMange.js";
import { deleteCustomer, getAllCustomers, getCustomerById, getMyProfile, login, register, resendEmailOtp, updateCustomerStatus, verifyEmailOtp, verifyLoginOtp } from "../Controller/AuthController.js";
import { verifyToken } from "../Middleware/authMiddleware.js";
import { authorizeRoles } from "../Middleware/roleMiddleware.js";
const router = express.Router();
router.post("/register", register);
router.post("/verify-email-otp", verifyEmailOtp);
router.post("/resend-email-otp", resendEmailOtp);
router.post("/login", login);
router.post("/verify-login-otp", verifyLoginOtp);

router.get(
  "/me",
  verifyToken,
  authorizeRoles("customer", "admin", "subadmin", "employee"),
  getMyProfile
);

// ================= WEBHOOK =================

router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveWebhook);
router.get("/webhook/check-token", checkFacebookToken);

// ================= PRODUCTS =================

router.post(
  "/addproduct",
  verifyToken,
  authorizeRoles("admin", "subadmin", "employee"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "colorImages", maxCount: 20 },
  ]),
  addProduct
);

router.get("/getALLproducts", getAllProduct);
router.get("/products", getProducts);

// ================= CATEGORIES =================

const categoryUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
]);

router.post(
  "/main",
  verifyToken,
  authorizeRoles("admin", "subadmin", "employee"),
  categoryUpload,
  createMainCategory
);

router.post(
  "/sub",
  verifyToken,
  authorizeRoles("admin", "subadmin", "employee"),
  categoryUpload,
  createSubCategory
);

router.post(
  "/child",
  verifyToken,
  authorizeRoles("admin", "subadmin", "employee"),
  categoryUpload,
  createChildCategory
);

router.post(
  "/sub-child",
  verifyToken,
  authorizeRoles("admin", "subadmin", "employee"),
  categoryUpload,
  createSubChildCategory
);

router.get("/tree", getFullCategoryTree);
router.patch("/:type/:id/banner", verifyToken, authorizeRoles("admin", "subadmin"), updateCategoryBanner);

// ================= ORDERS =================

router.post("/CreateOrder", createOrder);
router.get("/order-activity", verifyToken, authorizeRoles("admin", "subadmin", "employee"), OderActivity);
router.get("/summary", verifyToken, authorizeRoles("admin", "subadmin", "employee"), getDashboardSummary);
router.get("/order", verifyToken, authorizeRoles("admin", "subadmin", "employee"), getOrders);
router.get("/Allorders", verifyToken, authorizeRoles("admin", "subadmin", "employee"), getAllOrders);
router.patch("/bulk-update", verifyToken, authorizeRoles("admin", "subadmin", "employee"), bulkUpdateOrders);
router.put("/orders/:id", verifyToken, authorizeRoles("admin", "subadmin", "employee"), updateOrder);
router.delete("/orders/:id", verifyToken, authorizeRoles("admin", "subadmin"), deleteOrder);
router.get("/order-id/:orderId", getOrderByOrderId);
router.get("/:orderId/navigation", verifyToken, authorizeRoles("admin", "subadmin", "employee"), getOrderNavigation);

// ================= CUSTOMERS =================

router.get("/AllCustomers", verifyToken, authorizeRoles("admin", "subadmin", "employee"), getAllCustomers);
router.get("/getCustomer/:id", verifyToken, authorizeRoles("admin", "subadmin", "employee"), getCustomerById);
router.patch("/updateCustomerStatus/:id", verifyToken, authorizeRoles("admin", "subadmin"), updateCustomerStatus);
router.delete("/deleteCustomer/:id", verifyToken, authorizeRoles("admin", "subadmin"), deleteCustomer);

// ================= PRODUCT BY ID =================
// Keep generic product routes at the bottom.

router.get("/:id", getProductById);

router.put(
  "/updateproduct/:id",
  verifyToken,
  authorizeRoles("admin", "subadmin", "employee"),
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "colorImages", maxCount: 20 },
  ]),
  updateProduct
);

router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("admin", "subadmin"),
  deleteProduct
);


export default router;
