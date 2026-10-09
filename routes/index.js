import express from "express";

import upload from "../midddlewere/upload.js";
import {
  addProduct,
  getAllProduct,
  getProductById,
  getProducts,
  updateProduct,
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
import {  createOrder  } from "../Controller/CREATODER.js";
import { OderActivity } from "../Controller/ShowOderactivity.js";
import { getDashboardSummary } from "../Controller/Deshbord.js";
import { bulkUpdateOrders, deleteOrder, getOrders, updateOrder } from "../Controller/OrderMange.js";
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
router.patch(
  "/:type/:id/banner",
  updateCategoryBanner
);
router.get("/:id", getProductById);
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
  ]),
  updateProduct,
);




export default router;
