import express from "express";

import upload from "../midddlewere/upload.js";
import {
  addProduct,
  getAllProduct,
  getProductById,
  getProducts,
  updateProduct,
  deleteProduct,
  getReviewSummary,
  getProductReviews,
  createReview
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
import { deleteCustomer, getAllCustomers, getCustomerById, getMyProfile, login, register, resendEmailOtp, updateCustomerRole, updateCustomerStatus, verifyEmailOtp, verifyLoginOtp } from "../Controller/AuthController.js";
import { verifyToken } from "../Middleware/authMiddleware.js";
import { authorizeRoles } from "../Middleware/roleMiddleware.js";
import { createLandingPage, deleteLandingPage, getLandingPageById, getLandingPages, getPublishedLandingPage, getPublishedLandingPageBanners, getPublishedOffers, setLandingPageStatus, updateLandingPage } from "../Controller/LandingPageController.js";
const router = express.Router();

router.post(
  "/addproduct",
  upload.fields([
    {
      name: "images",
      maxCount: 10,
    },
    {
      name: "colorImages",
      maxCount: 20,
    },
    {
      name: "descriptionSectionImages",
      maxCount: 20,
    },
  ]),
  addProduct,
);


router.get("/webhook", verifyWebhook);

router.post("/webhook", receiveWebhook);
router.get("/webhook/check-token", checkFacebookToken);

router.get("/getALLproducts", getAllProduct);
router.post("/CreateOrder", createOrder);

router.post( "/main", upload.fields([ { name: "image", maxCount: 1 }, { name: "bannerImage", maxCount: 1 }, ]), createMainCategory ); 
// 

router.post( "/sub", upload.fields([ { name: "image", maxCount: 1 }, { name: "bannerImage", maxCount: 1 }, ]), createSubCategory ); 
 router.post( "/child", upload.fields([ { name: "image", maxCount: 1 }, { name: "bannerImage", maxCount: 1 }, ]), createChildCategory ); 
  router.post( "/sub-child", upload.fields([ { name: "image", maxCount: 1 }, { name: "bannerImage", maxCount: 1 }, ]), createSubChildCategory );
router.get("/tree", getFullCategoryTree);
router.get("/order-activity", OderActivity);
router.get("/summary", getDashboardSummary);
router.get("/products", getProducts);
router.get("/order", getOrders);
router.patch("/bulk-update", bulkUpdateOrders);
router.put("/orders/:id", updateOrder);
router.delete("/orders/:id", deleteOrder);
router.get("/Allorders", getAllOrders);

// GET /api/orders/:orderId/navigation

router.patch(
  "/:type/:id/banner",
  updateCategoryBanner
);
router.post("/register", register);
router.post("/verify-email-otp", verifyEmailOtp);
router.post("/resend-email-otp", resendEmailOtp);
router.post("/login", login);
router.post("/verify-login-otp", verifyLoginOtp);
router.get("/order-id/:orderId", getOrderByOrderId);
router.get(
  "/me",
  verifyToken,
  authorizeRoles("customer", "admin"),
  getMyProfile
);

router.put(
  "/updateproduct/:id",
  upload.fields([
    {
      name: "images",
      maxCount: 10,
    },
    {
      name: "colorImages",
      maxCount: 20,
    },
     {
      name: "descriptionSectionImages",
      maxCount: 20,
    },
  ]),
  updateProduct,
);
router.get("/:orderId/navigation", getOrderNavigation);

// GET /api/orders/:orderId

router.get("/AllCustomers", getAllCustomers);
router.get("/getCustomer/:id", getCustomerById);
router.patch("/updateCustomerStatus/:id", updateCustomerStatus);
router.delete("/deleteCustomer/:id", deleteCustomer);
router.patch("/updateCustomerRole/:id", updateCustomerRole);
router.get("/:productId/reviews/summary", getReviewSummary);
router.get("/:productId/reviews", getProductReviews);

router.get(
  "/published/banners",
  getPublishedLandingPageBanners
);
router.get("/public/offers", getPublishedOffers);
router.get("/public/:slug", getPublishedLandingPage);

// Admin routes
router.get("/getLandingPages",  getLandingPages);


router.post(
  "/createLandingPage",
  upload.fields([
    { name: "sectionImages", maxCount: 20 },
    { name: "bannerImages", maxCount: 20 },
    { name: "offerImages", maxCount: 20 },
  ]),
  createLandingPage,
);

router.get("/getLandingPage/:id",  getLandingPageById);

router.put("/updateLandingPage/:id",  updateLandingPage);

router.patch(
  "/updateLandingPageStatus/:id",
  
  setLandingPageStatus
);

router.delete("/deleteLandingPage/:id",  deleteLandingPage);




router.post(
  "/:productId/reviews",
  upload.array("images", 5),
  createReview
);







router.delete("/:id", deleteProduct);
router.get("/:id", getProductById);

export default router;
