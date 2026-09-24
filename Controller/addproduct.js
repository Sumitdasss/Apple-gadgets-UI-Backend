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
    // REQUIRED VALIDATION
    // ========================================

    // ========================================
// REQUIRED FIELDS
// Only these 4 fields are required
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

    const parseJSON = (value, fallback = []) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return fallback;
      }

      // যদি already array/object হয়
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
    // PARSE JSON FIELDS
    // ========================================

    let parsedColors = [];
    let parsedSizes = [];
    let parsedRam = [];
    let parsedSpecifications = [];
    let parsedVariants = [];

    try {
      parsedColors = parseJSON(colors, []);
      parsedSizes = parseJSON(sizes, []);
      parsedRam = parseJSON(ram, []);
      parsedSpecifications = parseJSON(
        specifications,
        []
      );
      parsedVariants = parseJSON(
        variants,
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

    if (!Array.isArray(parsedSpecifications)) {
      return res.status(400).json({
        success: false,
        message:
          "Specifications must be an array",
      });
    }

    if (!Array.isArray(parsedVariants)) {
      return res.status(400).json({
        success: false,
        message: "Variants must be an array",
      });
    }

    // ========================================
    // DEBUG VARIANTS
    // ========================================

    console.log(
      "PARSED VARIANTS:",
      parsedVariants
    );

    // ========================================
    // VALIDATE VARIANTS
    // ========================================

    for (const variant of parsedVariants) {
      if (!variant || typeof variant !== "object") {
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

      // Color normalize
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

    if (uploadedImages.length === 0) {
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
          name: color?.name || "",
          code:
            color?.code || "#000000",

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

    const productPrice = Number(price);

    if (
      Number.isNaN(productPrice) ||
      productPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product price",
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
      productDiscountPrice < productPrice
    ) {
      calculatedDiscountPercentage =
        (
          (productPrice -
            productDiscountPrice) /
          productPrice
        ) * 100;
    }

    // ========================================
    // FINAL DISCOUNT %
    // ========================================

    const finalDiscountPercentage =
      discountPercentage !== undefined &&
      discountPercentage !== ""
        ? Number(discountPercentage)
        : Number(
            calculatedDiscountPercentage.toFixed(
              2
            )
          );

    // ========================================
    // STOCK
    // ========================================

    const productStock = Number(stock);

    if (
      Number.isNaN(productStock) ||
      productStock < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock",
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
        name: name.trim(),

        slug: slug.trim(),

        description:
          description.trim(),

        shortDescription:
          shortDescription?.trim() || "",

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
        // BRAND
        // ====================================
        additionalCategories:additionalCategories,
        brand:
          brand?.trim() || "",

        // ====================================
        // PRICE
        // ====================================

        price: productPrice,

        discountPrice:
          productDiscountPrice,

        discountPercentage:
          finalDiscountPercentage,

        // ====================================
        // STOCK
        // ====================================

        stock: productStock,

        // ====================================
        // SKU
        // ====================================

        sku:
          sku?.trim() || "",

        // ====================================
        // COLORS
        // ====================================

        colors: finalColors,

        // ====================================
        // SIZES
        // ====================================

        sizes: parsedSizes,

        // ====================================
        // RAM
        // ====================================

        ram: parsedRam,

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

        rating: productRating,

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
        // PRODUCT IMAGES
        // ====================================

        images: uploadedImages,
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
        errors: Object.values(
          error.errors
        ).map(
          (err) => err.message
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

      // -----------------------------------------------
      // Find requested category
      // -----------------------------------------------

      const categoryData = await Category.findOne({
        slug,
        isActive: true,
      })
        .select(
          "_id name slug parent level path"
        )
        .lean();

      // -----------------------------------------------
      // Category not found
      // -----------------------------------------------

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
      // LEVEL 0
      // MAIN CATEGORY
      //
      // Example:
      //
      // Phones
      // ├── Samsung
      // ├── Apple
      // ├── Xiaomi
      // └── OnePlus
      //
      // Phones click করলে সব brand-এর product আসবে
      //
      // এবং additionalCategories-এ Phones দেওয়া
      // product-ও এখানে আসবে।
      // =================================================

      if (categoryData.level === 0) {
        const descendants = await Category.find({
          $or: [
            {
              path: categoryData._id,
            },
            {
              path: {
                $in: [categoryData._id],
              },
            },
            {
              parent: categoryData._id,
            },
          ],
          isActive: true,
        })
          .select("_id")
          .lean();

        // Main category + সব child category
        const categoryIds = [
          categoryData._id,
          ...descendants.map(
            (item) => item._id
          ),
        ];

        // Remove duplicate IDs
        const uniqueCategoryIds = [
          ...new Map(
            categoryIds.map((id) => [
              String(id),
              id,
            ])
          ).values(),
        ];

        filter.$or = [
          // ---------------------------------------------
          // Normal category
          // ---------------------------------------------

          {
            category: {
              $in: uniqueCategoryIds,
            },
          },

          // ---------------------------------------------
          // Sub category
          // ---------------------------------------------

          {
            subCategory: {
              $in: uniqueCategoryIds,
            },
          },

          // ---------------------------------------------
          // Child category
          // ---------------------------------------------

          {
            childCategory: {
              $in: uniqueCategoryIds,
            },
          },

          // ---------------------------------------------
          // Sub child category
          // ---------------------------------------------

          {
            subChildCategory: {
              $in: uniqueCategoryIds,
            },
          },

          // ---------------------------------------------
          // ⭐ Additional categories
          //
          // Example:
          //
          // Product:
          // category = Apple Product
          // subCategory = iPhone
          //
          // additionalCategories = [Phones]
          //
          // তাহলে Phones page-এও product আসবে।
          // ---------------------------------------------

          {
            additionalCategories: {
              $in: uniqueCategoryIds,
            },
          },
        ];
      }

      // =================================================
      // LEVEL 1
      // SUB CATEGORY
      //
      // Example:
      // Phones → iPhone
      //
      // =================================================

      else if (categoryData.level === 1) {
        const descendants = await Category.find({
          $or: [
            {
              path: categoryData._id,
            },
            {
              path: {
                $in: [categoryData._id],
              },
            },
            {
              parent: categoryData._id,
            },
          ],
          isActive: true,
        })
          .select("_id")
          .lean();

        const categoryIds = [
          categoryData._id,
          ...descendants.map(
            (item) => item._id
          ),
        ];

        const uniqueCategoryIds = [
          ...new Map(
            categoryIds.map((id) => [
              String(id),
              id,
            ])
          ).values(),
        ];

        filter.$or = [
          {
            subCategory: {
              $in: uniqueCategoryIds,
            },
          },

          {
            childCategory: {
              $in: uniqueCategoryIds,
            },
          },

          {
            subChildCategory: {
              $in: uniqueCategoryIds,
            },
          },

          // ⭐ Additional category
          {
            additionalCategories: {
              $in: uniqueCategoryIds,
            },
          },
        ];
      }

      // =================================================
      // LEVEL 2
      // CHILD CATEGORY
      // =================================================

      else if (categoryData.level === 2) {
        const descendants = await Category.find({
          $or: [
            {
              path: categoryData._id,
            },
            {
              path: {
                $in: [categoryData._id],
              },
            },
            {
              parent: categoryData._id,
            },
          ],
          isActive: true,
        })
          .select("_id")
          .lean();

        const categoryIds = [
          categoryData._id,
          ...descendants.map(
            (item) => item._id
          ),
        ];

        const uniqueCategoryIds = [
          ...new Map(
            categoryIds.map((id) => [
              String(id),
              id,
            ])
          ).values(),
        ];

        filter.$or = [
          {
            childCategory: {
              $in: uniqueCategoryIds,
            },
          },

          {
            subChildCategory: {
              $in: uniqueCategoryIds,
            },
          },

          // ⭐ Additional category
          {
            additionalCategories: {
              $in: uniqueCategoryIds,
            },
          },
        ];
      }

      // =================================================
      // LEVEL 3
      // SUB CHILD CATEGORY
      // =================================================

      else if (categoryData.level === 3) {
        filter.$or = [
          {
            subChildCategory:
              categoryData._id,
          },

          // ⭐ Additional category
          {
            additionalCategories:
              categoryData._id,
          },
        ];
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
      .populate(
        "additionalCategories",
        "name slug level parent"
      )
      .sort(sortOption)
      .lean();

    // =================================================
    // UNIQUE HELPER
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
    // BRAND
    // =================================================

    const brands = unique(
      products.map(
        (product) => product.brand
      )
    );

    // =================================================
    // SERIES
    // =================================================

    const series = unique(
      products.map(
        (product) => product.series
      )
    );

    // =================================================
    // DISPLAY SIZE
    // =================================================

    const displaySizes = unique(
      products.map(
        (product) =>
          product.displaySize ||
          product.display ||
          product.screenSize
      )
    );

    // =================================================
    // STORAGE
    // =================================================

    const storage = unique(
      products.map(
        (product) => product.storage
      )
    );

    // =================================================
    // PROCESSOR
    // =================================================

    const processors = unique(
      products.map(
        (product) => product.processor
      )
    );

    // =================================================
    // COLORS
    // =================================================

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
    // CATEGORY RESPONSE
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