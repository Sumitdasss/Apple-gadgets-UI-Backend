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

      // ⭐ Additional Categories
      additionalCategories,

      category,
      subCategory,
      childCategory,
      subChildCategory,

      variants,

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
    // REQUIRED FIELDS
    // ========================================

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
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
    // HELPER: PARSE JSON
    // ========================================

    const parseJSON = (
      value,
      fallback = []
    ) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return fallback;
      }

      // Already array/object হলে
      if (typeof value !== "string") {
        return value;
      }

      try {
        return JSON.parse(value);
      } catch (error) {
        throw new Error(
          `Invalid JSON data: ${error.message}`
        );
      }
    };

    // ========================================
    // PARSED JSON FIELDS
    // ========================================

    let parsedColors = [];
    let parsedSizes = [];
    let parsedRam = [];
    let parsedSpecifications = [];
    let parsedVariants = [];

    // ⭐ NEW
    let parsedAdditionalCategories = [];

    try {
      parsedColors =
        parseJSON(colors, []);

      parsedSizes =
        parseJSON(sizes, []);

      parsedRam =
        parseJSON(ram, []);

      parsedSpecifications =
        parseJSON(
          specifications,
          []
        );

      parsedVariants =
        parseJSON(
          variants,
          []
        );

      // ⭐ ADDITIONAL CATEGORIES
      parsedAdditionalCategories =
        parseJSON(
          additionalCategories,
          []
        );

    } catch (error) {
      console.error(
        "JSON PARSE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // ========================================
    // VALIDATE JSON ARRAYS
    // ========================================

    if (!Array.isArray(parsedColors)) {
      return res.status(400).json({
        success: false,
        message: "Colors must be an array",
      });
    }

    if (!Array.isArray(parsedSizes)) {
      return res.status(400).json({
        success: false,
        message: "Sizes must be an array",
      });
    }

    if (!Array.isArray(parsedRam)) {
      return res.status(400).json({
        success: false,
        message: "RAM must be an array",
      });
    }

    if (
      !Array.isArray(
        parsedSpecifications
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Specifications must be an array",
      });
    }

    if (
      !Array.isArray(parsedVariants)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Variants must be an array",
      });
    }

    // ⭐ ADDITIONAL CATEGORIES VALIDATION

    if (
      !Array.isArray(
        parsedAdditionalCategories
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Additional categories must be an array",
      });
    }

    // ========================================
    // DEBUG
    // ========================================

    console.log(
      "PARSED ADDITIONAL CATEGORIES:",
      parsedAdditionalCategories
    );

    console.log(
      "PARSED VARIANTS:",
      parsedVariants
    );

    // ========================================
    // VALIDATE VARIANTS
    // ========================================

    for (
      const variant of parsedVariants
    ) {
      if (
        !variant ||
        typeof variant !== "object"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Each variant must be an object",
        });
      }

      if (
        variant.stock !== undefined &&
        variant.stock !== ""
      ) {
        variant.stock = Number(
          variant.stock
        );
      }

      if (
        variant.price !== undefined &&
        variant.price !== ""
      ) {
        variant.price = Number(
          variant.price
        );
      }

      if (
        variant.ram !== undefined &&
        variant.ram !== null
      ) {
        variant.ram = String(
          variant.ram
        ).trim();
      }

      if (
        variant.storage !== undefined &&
        variant.storage !== null
      ) {
        variant.storage = String(
          variant.storage
        ).trim();
      }

      if (
        variant.sku !== undefined &&
        variant.sku !== null
      ) {
        variant.sku = String(
          variant.sku
        ).trim();
      }

      // ====================================
      // VARIANT COLOR NORMALIZE
      // ====================================

      if (
        variant.color &&
        typeof variant.color === "object"
      ) {
        variant.color = {
          name:
            variant.color.name || "",

          code:
            variant.color.code ||
            "#000000",
        };
      }
    }

    // ========================================
    // CHECK DUPLICATE SLUG
    // ========================================

    const existingProduct =
      await Product.findOne({
        slug: slug.trim(),
      });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message:
          `Product with slug "${slug}" already exists`,
      });
    }

    // ========================================
    // GET PRODUCT IMAGE FILES
    // ========================================

    const productImageFiles =
      req.files?.images || [];

    // ========================================
    // GET COLOR IMAGE FILES
    // ========================================

    const colorImageFiles =
      req.files?.colorImages || [];

    console.log(
      "PRODUCT IMAGE COUNT:",
      productImageFiles.length
    );

    console.log(
      "COLOR IMAGE COUNT:",
      colorImageFiles.length
    );

    // ========================================
    // PRODUCT IMAGE URLS
    // ========================================

    const uploadedImages =
      productImageFiles.map(
        (file) => file.path
      );

    // ========================================
    // PRODUCT IMAGE REQUIRED
    // ========================================

    if (
      uploadedImages.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one product image is required",
      });
    }

    // ========================================
    // COLOR IMAGE URLS
    // ========================================

    const uploadedColorImages =
      colorImageFiles.map(
        (file) => file.path
      );

    // ========================================
    // FINAL COLORS
    // ========================================

    const finalColors =
      parsedColors.map(
        (color, index) => ({
          name:
            color?.name || "",

          code:
            color?.code ||
            "#000000",

          image:
            uploadedColorImages[index] ||
            color?.image ||
            "",
        })
      );

    console.log(
      "FINAL COLORS:",
      finalColors
    );

    // ========================================
    // PRICE
    // ========================================

    const productPrice =
      Number(price);

    if (
      Number.isNaN(productPrice) ||
      productPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid product price",
      });
    }

    // ========================================
    // DISCOUNT PRICE
    // ========================================

    const productDiscountPrice =
      discountPrice !== undefined &&
      discountPrice !== ""
        ? Number(discountPrice)
        : null;

    if (
      productDiscountPrice !== null &&
      (
        Number.isNaN(
          productDiscountPrice
        ) ||
        productDiscountPrice < 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid discount price",
      });
    }

    // ========================================
    // CALCULATE DISCOUNT %
    // ========================================

    let calculatedDiscountPercentage = 0;

    if (
      productDiscountPrice !== null &&
      productPrice > 0 &&
      productDiscountPrice <
        productPrice
    ) {
      calculatedDiscountPercentage =
        (
          (
            productPrice -
            productDiscountPrice
          ) /
          productPrice
        ) * 100;
    }

    // ========================================
    // FINAL DISCOUNT %
    // ========================================

    const finalDiscountPercentage =
      discountPercentage !== undefined &&
      discountPercentage !== ""
        ? Number(
            discountPercentage
          )
        : Number(
            calculatedDiscountPercentage.toFixed(
              2
            )
          );

    // ========================================
    // STOCK
    // ========================================

    const productStock =
      Number(stock);

    if (
      Number.isNaN(productStock) ||
      productStock < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid stock",
      });
    }

    // ========================================
    // RATING
    // ========================================

    const productRating =
      rating !== undefined &&
      rating !== ""
        ? Number(rating)
        : 0;

    // ========================================
    // CREATE PRODUCT
    // ========================================

    const product =
      await Product.create({

        // ====================================
        // BASIC
        // ====================================

        name:
          name.trim(),

        slug:
          slug.trim(),

        description:
          description.trim(),

        shortDescription:
          shortDescription?.trim() ||
          "",

        // ====================================
        // CATEGORY
        // ====================================

        category,

        subCategory:
          subCategory || null,

        childCategory:
          childCategory || null,

        subChildCategory:
          subChildCategory || null,

        // ====================================
        // ⭐ ADDITIONAL CATEGORIES
        // ====================================

        additionalCategories:
          parsedAdditionalCategories,

        // ====================================
        // BRAND
        // ====================================

        brand:
          brand?.trim() || "",

        // ====================================
        // PRICE
        // ====================================

        price:
          productPrice,

        discountPrice:
          productDiscountPrice,

        discountPercentage:
          finalDiscountPercentage,

        // ====================================
        // STOCK
        // ====================================

        stock:
          productStock,

        // ====================================
        // SKU
        // ====================================

        sku:
          sku?.trim() || "",

        // ====================================
        // COLORS
        // ====================================

        colors:
          finalColors,

        // ====================================
        // SIZES
        // ====================================

        sizes:
          parsedSizes,

        // ====================================
        // RAM
        // ====================================

        ram:
          parsedRam,

        // ====================================
        // SPECIFICATIONS
        // ====================================

        specifications:
          parsedSpecifications,

        // ====================================
        // VARIANTS
        // ====================================

        variants:
          parsedVariants,

        // ====================================
        // RATING
        // ====================================

        rating:
          productRating,

        // ====================================
        // STATUS
        // ====================================

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

        // ====================================
        // SEO
        // ====================================

        metaTitle:
          metaTitle?.trim() || "",

        metaDescription:
          metaDescription?.trim() || "",

        // ====================================
        // IMAGES
        // ====================================

        images:
          uploadedImages,
      });

    // ========================================
    // SUCCESS
    // ========================================

    console.log(
      "PRODUCT CREATED:",
      product._id
    );

    return res.status(201).json({
      success: true,

      message:
        "Product added successfully",

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
    // DUPLICATE KEY ERROR
    // ========================================

    if (error.code === 11000) {

      const duplicateField =
        Object.keys(
          error.keyPattern || {}
        )[0];

      return res.status(400).json({
        success: false,

        message:
          `${duplicateField} already exists`,
      });
    }

    // ========================================
    // VALIDATION ERROR
    // ========================================

    if (
      error.name ===
      "ValidationError"
    ) {

      return res.status(400).json({
        success: false,

        message:
          "Product validation failed",

        errors:
          Object.values(
            error.errors
          ).map(
            (err) => ({
              field: err.path,
              message: err.message,
              value: err.value,
            })
          ),
      });
    }

    // ========================================
    // CAST ERROR
    // ========================================

    if (
      error.name ===
      "CastError"
    ) {

      return res.status(400).json({
        success: false,

        message:
          `Invalid value for ${error.path}`,

        error:
          error.message,
      });
    }

    // ========================================
    // GENERAL ERROR
    // ========================================

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

    const filter = {};

    // =================================================
    // CATEGORY FILTER
    // =================================================

    if (category.trim()) {
      const slug = category.trim().toLowerCase();

      // =================================================
      // FIND CATEGORY
      // =================================================

      const categoryData = await Category.findOne({
        slug: slug,
        isActive: true,
      })
        .select("_id name slug parent level path")
        .lean();

      // =================================================
      // CATEGORY NOT FOUND
      // =================================================

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
            price: {
              min: 0,
              max: 0,
            },
          },
        });
      }

      // =================================================
      // CURRENT CATEGORY ID
      // =================================================

      const currentCategoryId = categoryData._id;

      // =================================================
      // FIND CHILD CATEGORIES
      // =================================================

      const children = await Category.find({
        parent: currentCategoryId,
        isActive: true,
      })
        .select("_id")
        .lean();

      // =================================================
      // CATEGORY IDS
      // =================================================

      const categoryIds = [
        currentCategoryId,
        ...children.map((item) => item._id),
      ];

      // =================================================
      // REMOVE DUPLICATES
      // =================================================

      const uniqueCategoryIds = [
        ...new Map(
          categoryIds.map((id) => [
            String(id),
            id,
          ])
        ).values(),
      ];

      // =================================================
      // DEBUG
      // =================================================

      console.log(
        "======================================"
      );

      console.log(
        "CATEGORY REQUEST:",
        slug
      );

      console.log(
        "CATEGORY NAME:",
        categoryData.name
      );

      console.log(
        "CATEGORY ID:",
        String(currentCategoryId)
      );

      console.log(
        "CATEGORY LEVEL:",
        categoryData.level
      );

      console.log(
        "CATEGORY IDS:",
        uniqueCategoryIds.map((id) =>
          String(id)
        )
      );

      // =================================================
      // IMPORTANT DEBUG
      // =================================================

      const additionalCategoryCount =
        await Product.countDocuments({
          additionalCategories:
            currentCategoryId,
        });

      console.log(
        "ADDITIONAL CATEGORY PRODUCT COUNT:",
        additionalCategoryCount
      );

      console.log(
        "======================================"
      );

      // =================================================
      // ⭐ CATEGORY PRODUCT FILTER
      // =================================================

      filter.$or = [
        // Product category
        {
          category: {
            $in: uniqueCategoryIds,
          },
        },

        // Product subCategory
        {
          subCategory: {
            $in: uniqueCategoryIds,
          },
        },

        // Product childCategory
        {
          childCategory: {
            $in: uniqueCategoryIds,
          },
        },

        // Product subChildCategory
        {
          subChildCategory: {
            $in: uniqueCategoryIds,
          },
        },

        // ⭐ VERY IMPORTANT
        // additionalCategories
        {
          additionalCategories: {
            $in: uniqueCategoryIds,
          },
        },
      ];
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
      .populate(
        "additionalCategories",
        "name slug level parent"
      )
      .sort(sortOption)
      .lean();

    // =================================================
    // UNIQUE
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

    // =================================================
    // FILTER DATA
    // =================================================

    const brands = unique(
      products.map(
        (product) => product.brand
      )
    );

    const series = unique(
      products.map(
        (product) => product.series
      )
    );

    const displaySizes = unique(
      products.map(
        (product) =>
          product.displaySize ||
          product.display ||
          product.screenSize
      )
    );

    const storage = unique(
      products.map(
        (product) => product.storage
      )
    );

    const processors = unique(
      products.map(
        (product) => product.processor
      )
    );

    const colors = unique(
      products.flatMap(
        (product) =>
          Array.isArray(product.colors)
            ? product.colors.map(
                (color) =>
                  typeof color === "string"
                    ? color
                    : color?.name
              )
            : []
      )
    );

    // =================================================
    // PRICE RANGE
    // =================================================

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
    // SELECTED CATEGORY
    // =================================================

    let selectedCategory = null;

    if (category.trim()) {
      selectedCategory =
        await Category.findOne({
          slug: category
            .trim()
            .toLowerCase(),
          isActive: true,
        })
          .select(
            "name slug level parent path"
          )
          .lean();
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      count: products.length,

      products,

      category: selectedCategory
        ? {
            name:
              selectedCategory.name,

            slug:
              selectedCategory.slug,

            level:
              selectedCategory.level,

            parent:
              selectedCategory.parent,
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