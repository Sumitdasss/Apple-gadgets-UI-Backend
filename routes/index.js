import express from 'express';
import { addProduct, getAllProduct } from '../Controller/addproduct.js';
import upload from '../midddlewere/upload.js';
import { getAllCategories, getCategoryTree,createCategory,getAllChildCategories,createChildCategory,getRootCategories,getChildCategories,getCategoryById,updateCategory,deleteCategory } from '../Controller/Catgorihandelar.js';
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
router.get('/getallProduct',getAllProduct);

router.post("/creatcatagori", createCategory);
router.post("/addchaildcatagory", createChildCategory);
router.get("/getchaildcatagory", getAllChildCategories);


router.get("/getallcatgoris", getAllCategories);


router.get("/tree", getCategoryTree);


router.get("/root", getRootCategories);


router.get("/children/:parentId", getChildCategories);


router.get("/:id", getCategoryById);


router.put("/:id", updateCategory);


router.delete("/:id", deleteCategory);






export default router;