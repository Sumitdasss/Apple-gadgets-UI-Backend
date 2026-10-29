import express from "express";
import upload from "../midddlewere/upload.js";

import {
  addProduct,
  getAllProduct,
  getProductById,
  getProducts,
  updateProduct,
  deleteProduct,
  getProductCostsForReport,
} from "../Controller/addproduct.js";

import {
  createMainCategory,
  createSubCategory,
  createChildCategory,
  createSubChildCategory,
  getFullCategoryTree,
  updateCategoryBanner,
} from "../Controller/Catgorihandelar.js";

import { categoryCacheMiddleware } from "../utils/categoryCache.js";

import {
  assignCourierRider,
  createOrder,
  getAllOrders,
  getOrderByOrderId,
  getOrderNavigation,
} from "../Controller/CREATODER.js";

import { OderActivity } from "../Controller/ShowOderactivity.js";
import { getDashboardSummary } from "../Controller/Deshbord.js";

import {
  bulkUpdateOrders,
  deleteOrder,
  getOrders,
  updateOrder,
} from "../Controller/OrderMange.js";

import {
  deleteCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomerRole,
  updateCustomerStatus,
} from "../Controller/AuthController.js";

import { verifyToken } from "../Middleware/authMiddleware.js";
import { authorizeRoles } from "../Middleware/roleMiddleware.js";

import {
  createLandingPage,
  deleteLandingPage,
  getLandingPageById,
  getLandingPages,
  setLandingPageStatus,
  updateLandingPage,
} from "../Controller/LandingPageController.js";

import {
  assignOrder,
  getEmployeeReportById,
  getEmployeeReportSummary,
  getEmployees,
  reassignOrder,
} from "../Controller/EmployeeController.js";

import {
  getAdminProfile,
} from "../Controller/AdminAuthController.js";

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Admin auth guard — same as Admin-me                                  */
/* ------------------------------------------------------------------ */
const adminAuth = [
  verifyToken,
  authorizeRoles("admin", "subadmin", "order_manager"),
];

/* ------------------------------------------------------------------ */
/* Admin profile                                                       */
/* ------------------------------------------------------------------ */
router.get("/Admin-me", ...adminAuth, getAdminProfile);

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */
router.get("/summary", ...adminAuth, getDashboardSummary);
router.get("/order-activity", ...adminAuth, OderActivity);

/* ------------------------------------------------------------------ */
/* Products (admin)                                                    */
/* ------------------------------------------------------------------ */
router.post(
  "/addproduct",
  ...adminAuth,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "colorImages", maxCount: 20 },
    { name: "descriptionSectionImages", maxCount: 20 },
  ]),
  addProduct
);

router.put(
  "/updateproduct/:id",
  ...adminAuth,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "colorImages", maxCount: 20 },
    { name: "descriptionSectionImages", maxCount: 20 },
  ]),
  updateProduct
);

router.get("/getALLproducts", ...adminAuth, getAllProduct);
router.get("/products", ...adminAuth, getProducts);
router.get("/product-costs-report", ...adminAuth, getProductCostsForReport);
router.get("/products/:id", ...adminAuth, getProductById);
router.delete("/products/:id", ...adminAuth, deleteProduct);
// legacy path used by some frontend calls
router.delete("/:id", ...adminAuth, deleteProduct);
router.get("/:id", ...adminAuth, getProductById);

/* ------------------------------------------------------------------ */
/* Categories (admin create / banner)                                  */
/* Tree can stay readable for storefront; create/update need admin      */
/* ------------------------------------------------------------------ */
router.post(
  "/main",
  ...adminAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
  ]),
  createMainCategory
);

router.post(
  "/sub",
  ...adminAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
  ]),
  createSubCategory
);

router.post(
  "/child",
  ...adminAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
  ]),
  createChildCategory
);

router.post(
  "/sub-child",
  ...adminAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
  ]),
  createSubChildCategory
);

router.patch("/:type/:id/banner", ...adminAuth, updateCategoryBanner);

// Admin also needs tree for product forms — keep cache, require auth here
router.get("/tree", ...adminAuth, categoryCacheMiddleware, getFullCategoryTree);

/* ------------------------------------------------------------------ */
/* Orders (admin)                                                      */
/* ------------------------------------------------------------------ */
router.post("/CreateOrder", ...adminAuth, createOrder);
router.get("/order", ...adminAuth, getOrders);
router.get("/Allorders", ...adminAuth, getAllOrders);
router.get("/order-id/:orderId", ...adminAuth, getOrderByOrderId);
router.get("/:orderId/navigation", ...adminAuth, getOrderNavigation);
router.patch("/bulk-update", ...adminAuth, bulkUpdateOrders);
router.put("/orders/:id", ...adminAuth, updateOrder);
router.delete("/orders/:id", ...adminAuth, deleteOrder);
router.patch("/orders/:id/courier-rider", ...adminAuth, assignCourierRider);

/* ------------------------------------------------------------------ */
/* Customers (admin)                                                   */
/* ------------------------------------------------------------------ */
router.get("/AllCustomers", ...adminAuth, getAllCustomers);
router.get("/getCustomer/:id", ...adminAuth, getCustomerById);
router.patch("/updateCustomerStatus/:id", ...adminAuth, updateCustomerStatus);
router.patch("/updateCustomerRole/:id", ...adminAuth, updateCustomerRole);
router.delete("/deleteCustomer/:id", ...adminAuth, deleteCustomer);

/* ------------------------------------------------------------------ */
/* Landing pages (admin)                                               */
/* ------------------------------------------------------------------ */
router.get("/getLandingPages", ...adminAuth, getLandingPages);
router.get("/getLandingPage/:id", ...adminAuth, getLandingPageById);

router.post(
  "/createLandingPage",
  ...adminAuth,
  upload.fields([
    { name: "sectionImages", maxCount: 20 },
    { name: "bannerImages", maxCount: 20 },
    { name: "offerImages", maxCount: 20 },
  ]),
  createLandingPage
);

router.put("/updateLandingPage/:id", ...adminAuth, updateLandingPage);
router.patch("/updateLandingPageStatus/:id", ...adminAuth, setLandingPageStatus);
router.delete("/deleteLandingPage/:id", ...adminAuth, deleteLandingPage);

/* ------------------------------------------------------------------ */
/* Employees & assignment (admin)                                      */
/* ------------------------------------------------------------------ */
router.get("/getEmployees", ...adminAuth, getEmployees);
router.get("/employee-summary", ...adminAuth, getEmployeeReportSummary);
router.get(
  "/getEmployeeReportById/:employeeId",
  ...adminAuth,
  getEmployeeReportById
);
router.post("/assignOrder", ...adminAuth, assignOrder);
router.patch("/reassignOrder/:orderId", ...adminAuth, reassignOrder);

export default router;