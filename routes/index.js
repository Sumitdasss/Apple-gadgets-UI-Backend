import express from 'express';

import upload from '../midddlewere/upload.js';
import { addProduct,getAllProduct, getProducts} from '../Controller/addproduct.js';
import { receiveWebhook, verifyWebhook } from '../Controller/messengerController.js';
import { checkFacebookToken } from '../Service/messengerController.js';
import { createMainCategory, createSubCategory,createChildCategory,createSubChildCategory,getFullCategoryTree } from '../Controller/Catgorihandelar.js';
import { createOrder } from '../Controller/CREATODER.js';
import { OderActivity } from '../Controller/ShowOderactivity.js';
import { getDashboardSummary } from '../Controller/Deshbord.js';
const router = express.Router();
router.post('/addproduct',upload.fields([
  {
    name: "images",
    maxCount: 10,
  },
  {
    name: "colorImages",
    maxCount: 20,
  },
]),addProduct);


router.get("/webhook", verifyWebhook);

router.post("/webhook", receiveWebhook);
router.get(
  "/webhook/check-token",
  checkFacebookToken
);

router.get("/getALLproducts", getAllProduct);
router.post("/CreateOrder", createOrder);

router.post("/main",createMainCategory);
router.post("/sub", createSubCategory);
router.post("/child", createChildCategory);
router.post("/sub-child", createSubChildCategory);
router.get("/tree", getFullCategoryTree);
router.get("/order-activity", OderActivity);
router.get("/summary", getDashboardSummary);
router.get("/products", getProducts);







export default router;