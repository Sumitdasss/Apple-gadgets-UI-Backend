import mongoose from "mongoose";
import Product from "../Model/Product.js";
import Category from "../Model/Catagori.js";
export const addProduct = async (req, res) => {
  try {
    console.log("=================================");
    console.log("ADD PRODUCT REQUEST");
    console.log("=================================");

    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    const {
      name,
      slug,
      description,
      shortDescription,

      category,
      subCategory,
      childCategory,
      subChildCategory,

      brand,

      price,
      discountPrice,
      discountPercentage,

      stock,
      sku,

      colors,
      sizes,
      ram,
      specifications,

      rating,

      isActive,
      isFeatured,
      isNew,
      isBestSeller,

      metaTitle,
      metaDescription,
    } = req.body;

    // ========================================
    // REQUIRED VALIDATION
    // ========================================

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    if (!slug?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Slug is required",
      });
    }

    if (!description?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Description is required",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    if (price === undefined || price === "") {
      return res.status(400).json({
        success: false,
        message: "Price is required",
      });
    }

    if (stock === undefined || stock === "") {
      return res.status(400).json({
        success: false,
        message: "Stock is required",
      });
    }

    // ========================================
    // PARSE JSON FIELDS
    // ========================================

    let parsedColors = [];
    let parsedSizes = [];
    let parsedRam = [];
    let parsedSpecifications = [];

    try {
      parsedColors = colors ? JSON.parse(colors) : [];
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid colors JSON",
      });
    }

    try {
      parsedSizes = sizes ? JSON.parse(sizes) : [];
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid sizes JSON",
      });
    }

    try {
      parsedRam = ram ? JSON.parse(ram) : [];
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid RAM JSON",
      });
    }

    try {
      parsedSpecifications = specifications
        ? JSON.parse(specifications)
        : [];
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid specifications JSON",
      });
    }

    // ========================================
    // VALIDATE RAM
    // ========================================

    if (!Array.isArray(parsedRam)) {
      return res.status(400).json({
        success: false,
        message: "RAM must be an array",
      });
    }

    // ========================================
    // VALIDATE SPECIFICATIONS
    // ========================================

    if (!Array.isArray(parsedSpecifications)) {
      return res.status(400).json({
        success: false,
        message: "Specifications must be an array",
      });
    }

    // ========================================
    // CHECK DUPLICATE SLUG
    // ========================================

    const existingProduct = await Product.findOne({
      slug: slug.trim(),
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: `Product with slug "${slug}" already exists`,
      });
    }

    // ========================================
    // IMAGE UPLOAD
    // ========================================

    const uploadedImages = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        uploadedImages.push(file.path);
      }
    }

    // ========================================
    // IMAGE REQUIRED
    // ========================================

    if (uploadedImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required",
      });
    }

    // ========================================
    // PRICE
    // ========================================

    const productPrice = Number(price);

    const productDiscountPrice =
      discountPrice && discountPrice !== ""
        ? Number(discountPrice)
        : null;

    let calculatedDiscountPercentage = 0;

    if (
      productDiscountPrice !== null &&
      productPrice > 0 &&
      productDiscountPrice < productPrice
    ) {
      calculatedDiscountPercentage =
        ((productPrice - productDiscountPrice) /
          productPrice) *
        100;
    }

    // ========================================
    // CREATE PRODUCT
    // ========================================

    const product = await Product.create({
      name: name.trim(),

      slug: slug.trim(),

      description: description.trim(),

      shortDescription:
        shortDescription?.trim() || "",

      category,

      subCategory:
        subCategory || null,

      childCategory:
        childCategory || null,

      subChildCategory:
        subChildCategory || null,

      brand:
        brand?.trim() || "",

      price: productPrice,

      discountPrice:
        productDiscountPrice,

      discountPercentage:
        discountPercentage !== undefined &&
        discountPercentage !== ""
          ? Number(discountPercentage)
          : Number(
              calculatedDiscountPercentage.toFixed(2)
            ),

      stock: Number(stock),

      sku:
        sku?.trim() || "",

      colors: parsedColors,

      sizes: parsedSizes,

      // ⭐ RAM ARRAY
      ram: parsedRam,

      // ⭐ SPECIFICATION ARRAY
      specifications: parsedSpecifications,

      rating:
        rating !== undefined &&
        rating !== ""
          ? Number(rating)
          : 0,

      isActive:
        isActive === "true" ||
        isActive === true,

      isFeatured:
        isFeatured === "true" ||
        isFeatured === true,

      isNew:
        isNew === "true" ||
        isNew === true,

      isBestSeller:
        isBestSeller === "true" ||
        isBestSeller === true,

      metaTitle:
        metaTitle?.trim() || "",

      metaDescription:
        metaDescription?.trim() || "",

      images: uploadedImages,
    });

    // ========================================
    // SUCCESS
    // ========================================

    return res.status(201).json({
      success: true,
      message: "Product added successfully",

      product,
    });
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "ADD PRODUCT ERROR:"
    );

    console.error(error);

    console.error(
      "================================="
    );

    // ========================================
    // DUPLICATE KEY
    // ========================================

    if (error.code === 11000) {
      const duplicateField =
        Object.keys(error.keyPattern || {})[0];

      return res.status(400).json({
        success: false,
        message: `${duplicateField} already exists`,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to add product",
    });
  }
};
export const getAllProduct = async (req, res) => {
  try {
    const {
      category = "",
      brand = "",
      minPrice = "",
      maxPrice = "",
      stock = "",
      sort = "newest",
    } = req.query;


    // =================================================
    // BASE FILTER
    // =================================================

    const filter = {
      // এখানে আপাতত isActive দিচ্ছি না
      // কারণ তোমার দেখানো product-এ isActive: false আছে।
    };


    // =================================================
    // CATEGORY FILTER
    // =================================================

    if (category.trim()) {
      const slug = category.trim().toLowerCase();


      // ===============================================
      // Find Category by slug
      // ===============================================

      const categoryData = await Category.findOne({
        slug: slug,
        isActive: true,
      }).lean();


      // ===============================================
      // Category পাওয়া যায়নি
      // ===============================================

      if (!categoryData) {
        return res.status(200).json({
          success: true,
          count: 0,
          products: [],

          category: null,

          filters: {
            brands: [],
            series: [],
            displaySizes: [],
            storage: [],
            processors: [],
            colors: [],
          },
        });
      }


      // ===============================================
      // level অনুযায়ী Product field select
      // ===============================================

      if (categoryData.level === 0) {
        // Main Category

        filter.category = categoryData._id;
      }

      else if (categoryData.level === 1) {
        // Sub Category

        filter.subCategory = categoryData._id;
      }

      else if (categoryData.level === 2) {
        // Child Category

        filter.childCategory =
          categoryData._id;
      }

      else if (categoryData.level === 3) {
        // Sub Child Category

        filter.subChildCategory =
          categoryData._id;
      }
    }


    // =================================================
    // BRAND FILTER
    // =================================================

    if (brand.trim()) {
      const brands = brand
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (brands.length > 0) {
        filter.brand = {
          $in: brands,
        };
      }
    }


    // =================================================
    // PRICE FILTER
    // =================================================

    if (minPrice || maxPrice) {
      filter.discountPrice = {};

      if (minPrice) {
        filter.discountPrice.$gte =
          Number(minPrice);
      }

      if (maxPrice) {
        filter.discountPrice.$lte =
          Number(maxPrice);
      }
    }


    // =================================================
    // STOCK FILTER
    // =================================================

    if (stock === "in-stock") {
      filter.stock = {
        $gt: 0,
      };
    }

    if (stock === "out-of-stock") {
      filter.stock = {
        $lte: 0,
      };
    }


    // =================================================
    // SORT
    // =================================================

    let sortOption = {
      createdAt: -1,
    };


    switch (sort) {
      case "price-low":
        sortOption = {
          discountPrice: 1,
        };
        break;

      case "price-high":
        sortOption = {
          discountPrice: -1,
        };
        break;

      case "rating":
        sortOption = {
          rating: -1,
        };
        break;

      case "oldest":
        sortOption = {
          createdAt: 1,
        };
        break;

      case "newest":
      default:
        sortOption = {
          createdAt: -1,
        };
        break;
    }


    // =================================================
    // GET PRODUCTS
    // =================================================

    const products = await Product.find(filter)
      .populate(
        "category",
        "name slug level parent"
      )
      .populate(
        "subCategory",
        "name slug level parent"
      )
      .populate(
        "childCategory",
        "name slug level parent"
      )
      .populate(
        "subChildCategory",
        "name slug level parent"
      )
      .sort(sortOption)
      .lean();


    // =================================================
    // DYNAMIC FILTER DATA
    // =================================================

    const unique = (items) => {
      return [
        ...new Set(
          items
            .filter(
              (item) =>
                item !== undefined &&
                item !== null &&
                item !== ""
            )
            .map((item) =>
              String(item).trim()
            )
        ),
      ];
    };


    // ===============================================
    // BRAND
    // ===============================================

    const brands = unique(
      products.map(
        (product) => product.brand
      )
    );


    // ===============================================
    // SERIES
    // ===============================================

    const series = unique(
      products.map(
        (product) => product.series
      )
    );


    // ===============================================
    // DISPLAY SIZE
    // ===============================================

    const displaySizes = unique(
      products.map(
        (product) =>
          product.displaySize ||
          product.display ||
          product.screenSize
      )
    );


    // ===============================================
    // STORAGE
    // ===============================================

    const storage = unique(
      products.map(
        (product) => product.storage
      )
    );


    // ===============================================
    // PROCESSOR
    // ===============================================

    const processors = unique(
      products.map(
        (product) => product.processor
      )
    );


    // ===============================================
    // COLORS
    // ===============================================

    const colors = unique(
      products.flatMap(
        (product) =>
          Array.isArray(product.colors)
            ? product.colors.map(
                (color) =>
                  typeof color === "string"
                    ? color
                    : color.name
              )
            : []
      )
    );


    // ===============================================
    // PRICE RANGE
    // ===============================================

    const prices = products
      .map(
        (product) =>
          Number(
            product.discountPrice ||
              product.price ||
              0
          )
      )
      .filter(
        (price) => price > 0
      );


    const minProductPrice =
      prices.length
        ? Math.min(...prices)
        : 0;


    const maxProductPrice =
      prices.length
        ? Math.max(...prices)
        : 0;


    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      count: products.length,

      products,

      category: category
        ? {
            name: (
              await Category.findOne({
                slug: category
                  .trim()
                  .toLowerCase(),
              }).select("name slug level parent")
            )?.name,
            slug: category,
          }
        : null,

      filters: {
        brands,
        series,
        displaySizes,
        storage,
        processors,
        colors,

        price: {
          min: minProductPrice,
          max: maxProductPrice,
        },
      },
    });

  } catch (error) {
    console.error(
      "Get all product error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get products",
      error: error.message,
    });
  }
};