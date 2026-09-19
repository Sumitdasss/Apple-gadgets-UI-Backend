import mongoose from "mongoose";
import Product from "../Model/Product.js";

export const addProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      shortDescription,
      category,
      subCategory,
      brand,
      price,
      discountPrice,
      discountPercentage,
      childCategory,
      stock,
      sku,
      colors,
      subChildCategory,
      sizes,
      specifications,
      rating,
      isActive,
      isFeatured,
      isNew,
      isBestSeller,
      metaTitle,
      metaDescription,
    } = req.body;
console.log("CATEGORY:", category);
console.log("SUB CATEGORY:", subCategory);
    // =========================
    // REQUIRED FIELD CHECK
    // =========================
    if (
      !name ||
      !description ||
      !price ||
      !category ||
      !stock ||
      !sku ||
      !colors ||
      !specifications ||
      !rating ||
      !isActive ||
      !isFeatured ||
      !isNew ||
      !isBestSeller ||
      !metaTitle ||
      !metaDescription
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // =========================
    // CATEGORY OBJECT ID CHECK
    // =========================
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    // =========================
    // SUB CATEGORY OBJECT ID CHECK
    // =========================
    if (
      subCategory &&
      !mongoose.Types.ObjectId.isValid(subCategory)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid subCategory ID",
      });
    }

    // =========================
    // IMAGE CHECK
    // =========================
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Product image is required",
      });
    }

    // =========================
    // PARSE COLORS
    // =========================
    const parsedColors =
      typeof colors === "string"
        ? JSON.parse(colors)
        : colors;

    // =========================
    // PARSE SPECIFICATIONS
    // =========================
   

let parsedSpecifications = [];

if (specifications) {
  try {
    parsedSpecifications =
      typeof specifications === "string"
        ? JSON.parse(specifications)
        : specifications;
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid specifications JSON",
    });
  }
}

    // =========================
    // CREATE PRODUCT
    // =========================
    const product = await Product.create({
      name,
      slug,
      description,
      shortDescription,

    childCategory:childCategory || null,
      // MongoDB Category ObjectId
      category,

      // MongoDB SubCategory ObjectId
      subCategory: subCategory || null,

      brand,
      price,
      discountPrice,
      discountPercentage,
      stock,
      sku,

      colors: parsedColors,
      sizes,
specifications: parsedSpecifications,

      rating,
subChildCategory:subChildCategory,
      isActive,
      isFeatured,
      isNew,
      isBestSeller,

      metaTitle,
      metaDescription,

      images: req.file.path,
      cloudinaryId: req.file.filename,
    });

    return res.status(201).json({
      success: true,
      message: "Product added successfully",
      data: product,
    });
  } catch (error) {
    console.error("Add Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Product add failed",
      error: error.message,
    });
  }
};