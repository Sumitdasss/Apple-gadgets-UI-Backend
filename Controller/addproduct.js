import mongoose from "mongoose";
import Product from "../Model/Product.js";

import {
  MainCategory,
  SubCategory,
  ChildCategory,
  SubChildCategory,
} from "../Model/Catagori.js";

/* =========================================================
   HELPERS
========================================================= */

const parseJSON = (value, fallback = []) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

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

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const toBoolean = (value) => {
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1"
  );
};

const cleanString = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
};

const uniqueObjectIds = (ids = []) => {
  const map = new Map();

  for (const id of ids) {
    if (!id) continue;

    const stringId = String(id);

    if (!map.has(stringId)) {
      map.set(stringId, id);
    }
  }

  return [...map.values()];
};

const uniqueStrings = (items = []) => {
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
        .filter(Boolean)
    ),
  ];
};

/* =========================================================
   ADD PRODUCT
========================================================= */

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

    /* =====================================================
       REQUIRED
    ===================================================== */

    const productName = cleanString(name);
    const productSlug = cleanString(slug);

    if (!productName) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    if (!productSlug) {
      return res.status(400).json({
        success: false,
        message: "Product slug is required",
      });
    }

    if (
      price === undefined ||
      price === null ||
      price === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Price is required",
      });
    }

    if (
      stock === undefined ||
      stock === null ||
      stock === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Stock is required",
      });
    }

    /* =====================================================
       PARSE JSON
    ===================================================== */

    let parsedColors = [];
    let parsedSizes = [];
    let parsedRam = [];
    let parsedSpecifications = [];
    let parsedVariants = [];
    let parsedAdditionalCategories = [];

    try {
      parsedColors = parseJSON(colors, []);
      parsedSizes = parseJSON(sizes, []);
      parsedRam = parseJSON(ram, []);
      parsedSpecifications =
        parseJSON(specifications, []);
      parsedVariants = parseJSON(variants, []);

      parsedAdditionalCategories =
        parseJSON(
          additionalCategories,
          []
        );
    } catch (error) {
      console.error("JSON PARSE ERROR:", error);

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    /* =====================================================
       ARRAY VALIDATION
    ===================================================== */

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
        message:
          "Variants must be an array",
      });
    }

    if (!Array.isArray(parsedAdditionalCategories)) {
      return res.status(400).json({
        success: false,
        message:
          "Additional categories must be an array",
      });
    }

    /* =====================================================
       MAIN CATEGORY
    ===================================================== */

    if (
      !category ||
      !isValidObjectId(category)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid main category is required",
      });
    }

    const mainCategory =
      await MainCategory.findOne({
        _id: category,
        isActive: { $ne: false },
      }).lean();

    if (!mainCategory) {
      return res.status(400).json({
        success: false,
        message:
          "Main category not found or inactive",
      });
    }

    /* =====================================================
       SUB CATEGORY
    ===================================================== */

    let validatedSubCategory = null;

    if (subCategory) {
      if (!isValidObjectId(subCategory)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid sub category",
        });
      }

      validatedSubCategory =
        await SubCategory.findOne({
          _id: subCategory,
          mainCategory: category,
          isActive: { $ne: false },
        }).lean();

      if (!validatedSubCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Sub category does not belong to selected main category",
        });
      }
    }

    /* =====================================================
       CHILD CATEGORY
    ===================================================== */

    let validatedChildCategory = null;

    if (childCategory) {
      if (!isValidObjectId(childCategory)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid child category",
        });
      }

      if (!subCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Sub category is required for child category",
        });
      }

      validatedChildCategory =
        await ChildCategory.findOne({
          _id: childCategory,
          subCategory: subCategory,
          mainCategory: category,
          isActive: { $ne: false },
        }).lean();

      if (!validatedChildCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Child category does not belong to selected sub category",
        });
      }
    }

    /* =====================================================
       SUB CHILD CATEGORY
    ===================================================== */

    let validatedSubChildCategory = null;

    if (subChildCategory) {
      if (
        !isValidObjectId(subChildCategory)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid sub-child category",
        });
      }

      if (!childCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Child category is required for sub-child category",
        });
      }

      validatedSubChildCategory =
        await SubChildCategory.findOne({
          _id: subChildCategory,
          childCategory: childCategory,
          subCategory: subCategory,
          mainCategory: category,
          isActive: { $ne: false },
        }).lean();

      if (!validatedSubChildCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Sub-child category does not belong to selected child category",
        });
      }
    }

    /* =====================================================
       ADDITIONAL CATEGORIES
    ===================================================== */

    const validAdditionalIds =
      parsedAdditionalCategories.filter(
        (id) => isValidObjectId(id)
      );

    const cleanAdditionalCategories =
      uniqueObjectIds(
        validAdditionalIds
      );

    /* =====================================================
       VARIANTS
    ===================================================== */

    for (const variant of parsedVariants) {
      if (
        !variant ||
        typeof variant !== "object" ||
        Array.isArray(variant)
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

        if (
          Number.isNaN(variant.stock) ||
          variant.stock < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid variant stock",
          });
        }
      }

      if (
        variant.price !== undefined &&
        variant.price !== ""
      ) {
        variant.price = Number(
          variant.price
        );

        if (
          Number.isNaN(variant.price) ||
          variant.price < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid variant price",
          });
        }
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

      if (
        variant.color &&
        typeof variant.color === "object"
      ) {
        variant.color = {
          name: String(
            variant.color.name || ""
          ).trim(),

          code:
            variant.color.code ||
            "#000000",

          image:
            variant.color.image ||
            "",
        };
      }
    }

    /* =====================================================
       DUPLICATE SLUG
    ===================================================== */

    const existingProduct =
      await Product.findOne({
        slug: productSlug,
      }).lean();

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message:
          `Product with slug "${productSlug}" already exists`,
      });
    }

    /* =====================================================
       IMAGES
    ===================================================== */

    const productImageFiles =
      req.files?.images || [];

    const colorImageFiles =
      req.files?.colorImages || [];

    const uploadedImages =
      productImageFiles.map(
        (file) => file.path
      );

    if (uploadedImages.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "At least one product image is required",
      });
    }

    const uploadedColorImages =
      colorImageFiles.map(
        (file) => file.path
      );

    /* =====================================================
       COLORS
    ===================================================== */

    const finalColors =
      parsedColors.map(
        (color, index) => ({
          name: cleanString(
            color?.name
          ),

          code:
            color?.code ||
            "#000000",

          image:
            uploadedColorImages[index] ||
            color?.image ||
            "",
        })
      );

    /* =====================================================
       PRICE
    ===================================================== */

    const productPrice = Number(price);

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

    /* =====================================================
       DISCOUNT PRICE
    ===================================================== */

    const productDiscountPrice =
      discountPrice !== undefined &&
      discountPrice !== null &&
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

    if (
      productDiscountPrice !== null &&
      productDiscountPrice >=
        productPrice &&
      productPrice > 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Discount price must be lower than product price",
      });
    }

    /* =====================================================
       DISCOUNT %
    ===================================================== */

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
        ) *
        100;
    }

    let finalDiscountPercentage =
      Number(
        calculatedDiscountPercentage.toFixed(2)
      );

    if (
      discountPercentage !== undefined &&
      discountPercentage !== ""
    ) {
      const manuallyEntered =
        Number(discountPercentage);

      if (
        Number.isNaN(manuallyEntered) ||
        manuallyEntered < 0 ||
        manuallyEntered > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid discount percentage",
        });
      }

      finalDiscountPercentage =
        manuallyEntered;
    }

    /* =====================================================
       STOCK
    ===================================================== */

    const productStock = Number(stock);

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

    /* =====================================================
       RATING
    ===================================================== */

    const productRating =
      rating !== undefined &&
      rating !== ""
        ? Number(rating)
        : 0;

    if (
      Number.isNaN(productRating) ||
      productRating < 0 ||
      productRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Rating must be between 0 and 5",
      });
    }

    /* =====================================================
       CREATE PRODUCT
    ===================================================== */

    const product =
      await Product.create({
        name: productName,

        slug: productSlug,

        description:
          cleanString(description),

        shortDescription:
          cleanString(
            shortDescription
          ),

        // 4 LEVEL CATEGORY

        category: category,

        subCategory:
          subCategory || null,

        childCategory:
          childCategory || null,

        subChildCategory:
          subChildCategory || null,

        // ADDITIONAL

        additionalCategories:
          cleanAdditionalCategories,

        // BRAND

        brand:
          cleanString(brand),

        // PRICE

        price: productPrice,

        discountPrice:
          productDiscountPrice,

        discountPercentage:
          finalDiscountPercentage,

        // STOCK

        stock: productStock,

        sku:
          cleanString(sku),

        // COLORS

        colors: finalColors,

        // SIZES

        sizes: uniqueStrings(
          parsedSizes
        ),

        // RAM

        ram: uniqueStrings(
          parsedRam
        ),

        // SPECIFICATIONS

        specifications:
          parsedSpecifications,

        // VARIANTS

        variants: parsedVariants,

        // RATING

        rating: productRating,

        // STATUS

        isActive:
          isActive === undefined
            ? true
            : toBoolean(isActive),

        isFeatured:
          toBoolean(isFeatured),

        isNew:
          toBoolean(isNew),

        isBestSeller:
          toBoolean(isBestSeller),

        // SEO

        metaTitle:
          cleanString(metaTitle),

        metaDescription:
          cleanString(
            metaDescription
          ),

        // IMAGES

        images: uploadedImages,
      });

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
      "ADD PRODUCT ERROR"
    );

    console.error(error);

    console.error(
      "================================="
    );

    if (error.code === 11000) {
      const duplicateField =
        Object.keys(
          error.keyPattern || {}
        )[0] || "field";

      return res.status(400).json({
        success: false,
        message:
          `${duplicateField} already exists`,
      });
    }

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
          ).map((err) => ({
            field: err.path,
            message: err.message,
            value: err.value,
          })),
      });
    }

    if (
      error.name ===
      "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid value for ${error.path}`,

        error: error.message,
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

/* =========================================================
   GET ALL PRODUCTS
========================================================= */

export const getAllProduct = async (
  req,
  res
) => {
  try {
    const {
      category = "",
      brand = "",
      minPrice = "",
      maxPrice = "",
      stock = "",
      sort = "newest",
    } = req.query;

    /* =====================================================
       SAFE QUERY VALUES
    ===================================================== */

    const categoryQuery =
      typeof category === "string"
        ? category.trim()
        : "";

    const brandQuery =
      typeof brand === "string"
        ? brand.trim()
        : "";

    const minPriceQuery =
      typeof minPrice === "string"
        ? minPrice.trim()
        : "";

    const maxPriceQuery =
      typeof maxPrice === "string"
        ? maxPrice.trim()
        : "";

    const stockQuery =
      typeof stock === "string"
        ? stock.trim()
        : "";

    const sortQuery =
      typeof sort === "string"
        ? sort.trim()
        : "newest";

    const filter = {};

    /* =====================================================
       CATEGORY FILTER
    ===================================================== */

    if (categoryQuery) {
      const slug =
        categoryQuery.toLowerCase();

      let categoryData = null;
      let categoryLevel = null;

      /* MAIN */

      categoryData =
        await MainCategory.findOne({
          slug,
          isActive: { $ne: false },
        })
          .select("_id name slug")
          .lean();

      if (categoryData) {
        categoryLevel = "main";
      }

      /* SUB */

      if (!categoryData) {
        categoryData =
          await SubCategory.findOne({
            slug,
            isActive: { $ne: false },
          })
            .select(
              "_id name slug mainCategory"
            )
            .lean();

        if (categoryData) {
          categoryLevel = "sub";
        }
      }

      /* CHILD */

      if (!categoryData) {
        categoryData =
          await ChildCategory.findOne({
            slug,
            isActive: { $ne: false },
          })
            .select(
              "_id name slug mainCategory subCategory"
            )
            .lean();

        if (categoryData) {
          categoryLevel = "child";
        }
      }

      /* SUB CHILD */

      if (!categoryData) {
        categoryData =
          await SubChildCategory.findOne({
            slug,
            isActive: { $ne: false },
          })
            .select(
              "_id name slug mainCategory subCategory childCategory"
            )
            .lean();

        if (categoryData) {
          categoryLevel = "subChild";
        }
      }

      /* NOT FOUND */

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

      /* =================================================
         CATEGORY IDS
      ================================================= */

      const categoryIds = [
        categoryData._id,
      ];

      /* MAIN */

      if (categoryLevel === "main") {
        const subCategories =
          await SubCategory.find({
            mainCategory:
              categoryData._id,
            isActive: {
              $ne: false,
            },
          })
            .select("_id")
            .lean();

        categoryIds.push(
          ...subCategories.map(
            (item) => item._id
          )
        );

        const childCategories =
          await ChildCategory.find({
            mainCategory:
              categoryData._id,
            isActive: {
              $ne: false,
            },
          })
            .select("_id")
            .lean();

        categoryIds.push(
          ...childCategories.map(
            (item) => item._id
          )
        );

        const subChildCategories =
          await SubChildCategory.find({
            mainCategory:
              categoryData._id,
            isActive: {
              $ne: false,
            },
          })
            .select("_id")
            .lean();

        categoryIds.push(
          ...subChildCategories.map(
            (item) => item._id
          )
        );
      }

      /* SUB */

      if (categoryLevel === "sub") {
        const childCategories =
          await ChildCategory.find({
            subCategory:
              categoryData._id,
            isActive: {
              $ne: false,
            },
          })
            .select("_id")
            .lean();

        categoryIds.push(
          ...childCategories.map(
            (item) => item._id
          )
        );

        const subChildCategories =
          await SubChildCategory.find({
            subCategory:
              categoryData._id,
            isActive: {
              $ne: false,
            },
          })
            .select("_id")
            .lean();

        categoryIds.push(
          ...subChildCategories.map(
            (item) => item._id
          )
        );
      }

      /* CHILD */

      if (categoryLevel === "child") {
        const subChildCategories =
          await SubChildCategory.find({
            childCategory:
              categoryData._id,
            isActive: {
              $ne: false,
            },
          })
            .select("_id")
            .lean();

        categoryIds.push(
          ...subChildCategories.map(
            (item) => item._id
          )
        );
      }

      const uniqueCategoryIds =
        uniqueObjectIds(
          categoryIds
        );

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
        "CATEGORY LEVEL:",
        categoryLevel
      );

      console.log(
        "CATEGORY IDS:",
        uniqueCategoryIds.map(
          (id) => String(id)
        )
      );

      console.log(
        "======================================"
      );

      /* =================================================
         CATEGORY FIELD SPECIFIC FILTER
      ================================================= */

      if (categoryLevel === "main") {
        filter.$or = [
          {
            category:
              categoryData._id,
          },
          {
            additionalCategories:
              categoryData._id,
          },
        ];
      }

      if (categoryLevel === "sub") {
        filter.$or = [
          {
            subCategory:
              categoryData._id,
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
          {
            additionalCategories:
              categoryData._id,
          },
        ];
      }

      if (categoryLevel === "child") {
        filter.$or = [
          {
            childCategory:
              categoryData._id,
          },
          {
            subChildCategory: {
              $in: uniqueCategoryIds,
            },
          },
          {
            additionalCategories:
              categoryData._id,
          },
        ];
      }

      if (
        categoryLevel === "subChild"
      ) {
        filter.$or = [
          {
            subChildCategory:
              categoryData._id,
          },
          {
            additionalCategories:
              categoryData._id,
          },
        ];
      }
    }

    /* =====================================================
       BRAND
    ===================================================== */

    if (brandQuery) {
      const brands =
        brandQuery
          .split(",")
          .map((item) =>
            item.trim()
          )
          .filter(Boolean);

      if (brands.length > 0) {
        filter.brand = {
          $in: brands,
        };
      }
    }

    /* =====================================================
       PRICE
    ===================================================== */

    if (
      minPriceQuery ||
      maxPriceQuery
    ) {
      const min =
        minPriceQuery
          ? Number(minPriceQuery)
          : null;

      const max =
        maxPriceQuery
          ? Number(maxPriceQuery)
          : null;

      if (
        min !== null &&
        Number.isNaN(min)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid minimum price",
        });
      }

      if (
        max !== null &&
        Number.isNaN(max)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid maximum price",
        });
      }

      const priceConditions = [];

      if (min !== null) {
        priceConditions.push({
          $gte: [
            {
              $cond: [
                {
                  $and: [
                    {
                      $ne: [
                        "$discountPrice",
                        null,
                      ],
                    },
                    {
                      $lt: [
                        "$discountPrice",
                        "$price",
                      ],
                    },
                  ],
                },
                "$discountPrice",
                "$price",
              ],
            },
            min,
          ],
        });
      }

      if (max !== null) {
        priceConditions.push({
          $lte: [
            {
              $cond: [
                {
                  $and: [
                    {
                      $ne: [
                        "$discountPrice",
                        null,
                      ],
                    },
                    {
                      $lt: [
                        "$discountPrice",
                        "$price",
                      ],
                    },
                  ],
                },
                "$discountPrice",
                "$price",
              ],
            },
            max,
          ],
        });
      }

      if (priceConditions.length > 0) {
        filter.$expr = {
          $and: priceConditions,
        };
      }
    }

    /* =====================================================
       STOCK
    ===================================================== */

    if (
      stockQuery === "in-stock"
    ) {
      filter.stock = {
        $gt: 0,
      };
    }

    if (
      stockQuery === "out-of-stock"
    ) {
      filter.stock = {
        $lte: 0,
      };
    }

    /* =====================================================
       SORT
    ===================================================== */

    let sortOption = {
      createdAt: -1,
    };

    switch (sortQuery) {
      case "price-low":
        sortOption = {
          discountPrice: 1,
          price: 1,
        };
        break;

      case "price-high":
        sortOption = {
          discountPrice: -1,
          price: -1,
        };
        break;

      case "rating":
        sortOption = {
          rating: -1,
          createdAt: -1,
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

    /* =====================================================
       GET PRODUCTS
    ===================================================== */

    const products =
      await Product.find(filter)
        .populate({
          path: "category",
          model: "MainCategory",
        })
        .populate({
          path: "subCategory",
          model: "SubCategory",
        })
        .populate({
          path: "childCategory",
          model: "ChildCategory",
        })
        .populate({
          path: "subChildCategory",
          model: "SubChildCategory",
        })
        .populate({
          path: "additionalCategories",
          model: "MainCategory",
        })
        .sort(sortOption)
        .lean();

    /* =====================================================
       FILTER DATA
    ===================================================== */

    const brands =
      uniqueStrings(
        products.map(
          (product) =>
            product.brand
        )
      );

    const series =
      uniqueStrings(
        products.map(
          (product) =>
            product.series
        )
      );

    const displaySizes =
      uniqueStrings(
        products.map(
          (product) =>
            product.displaySize ||
            product.display ||
            product.screenSize
        )
      );

    /* =====================================================
       STORAGE
    ===================================================== */

    const storage =
      uniqueStrings(
        products.flatMap(
          (product) => {
            if (
              Array.isArray(
                product.variants
              )
            ) {
              return product.variants
                .map(
                  (variant) =>
                    variant?.storage
                )
                .filter(Boolean);
            }

            if (
              Array.isArray(
                product.storage
              )
            ) {
              return product.storage;
            }

            return product.storage
              ? [product.storage]
              : [];
          }
        )
      );

    /* =====================================================
       PROCESSORS
    ===================================================== */

    const processors =
      uniqueStrings(
        products.map(
          (product) =>
            product.processor
        )
      );

    /* =====================================================
       COLORS
    ===================================================== */

    const colors =
      uniqueStrings(
        products.flatMap(
          (product) =>
            Array.isArray(
              product.colors
            )
              ? product.colors
                  .map(
                    (color) =>
                      typeof color ===
                      "string"
                        ? color
                        : color?.name
                  )
                  .filter(Boolean)
              : []
        )
      );

    /* =====================================================
       PRICE RANGE
    ===================================================== */

    const prices =
      products
        .map((product) => {
          const discount =
            Number(
              product.discountPrice
            );

          const regular =
            Number(product.price);

          if (
            Number.isFinite(discount) &&
            discount > 0 &&
            discount < regular
          ) {
            return discount;
          }

          return regular;
        })
        .filter(
          (price) =>
            Number.isFinite(price) &&
            price > 0
        );

    const minProductPrice =
      prices.length > 0
        ? Math.min(...prices)
        : 0;

    const maxProductPrice =
      prices.length > 0
        ? Math.max(...prices)
        : 0;

    /* =====================================================
       SELECTED CATEGORY
    ===================================================== */

    let selectedCategory = null;

    if (categoryQuery) {
      const slug =
        categoryQuery.toLowerCase();

      selectedCategory =
        await MainCategory.findOne({
          slug,
          isActive: {
            $ne: false,
          },
        })
          .select(
            "name slug"
          )
          .lean();

      if (!selectedCategory) {
        selectedCategory =
          await SubCategory.findOne({
            slug,
            isActive: {
              $ne: false,
            },
          })
            .select(
              "name slug mainCategory"
            )
            .lean();
      }

      if (!selectedCategory) {
        selectedCategory =
          await ChildCategory.findOne({
            slug,
            isActive: {
              $ne: false,
            },
          })
            .select(
              "name slug mainCategory subCategory"
            )
            .lean();
      }

      if (!selectedCategory) {
        selectedCategory =
          await SubChildCategory.findOne({
            slug,
            isActive: {
              $ne: false,
            },
          })
            .select(
              "name slug mainCategory subCategory childCategory"
            )
            .lean();
      }
    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      count:
        products.length,

      products,

      category:
        selectedCategory
          ? {
              name:
                selectedCategory.name,

              slug:
                selectedCategory.slug,

              mainCategory:
                selectedCategory.mainCategory ||
                null,

              subCategory:
                selectedCategory.subCategory ||
                null,

              childCategory:
                selectedCategory.childCategory ||
                null,
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
          min:
            minProductPrice,

          max:
            maxProductPrice,
        },
      },
    });
  } catch (error) {
    console.error(
      "======================================"
    );

    console.error(
      "GET ALL PRODUCT ERROR"
    );

    console.error(error);

    console.error(
      "MESSAGE:",
      error.message
    );

    console.error(
      "======================================"
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to get products",

      error:
        error.message,
    });
  }
};




/* =========================================================
   GET ALL PRODUCTS / SEARCH PRODUCTS
   GET /products
   GET /products?search=iphone
========================================================= */

export const getProducts = async (req, res) => {
  try {
    const { search } = req.query;

    let filter = {};

    /* ============================================
       SEARCH
    ============================================ */

    if (search && search.trim()) {
      filter = {
        $or: [
          {
            name: {
              $regex: search.trim(),
              $options: "i",
            },
          },
          {
            slug: {
              $regex: search.trim(),
              $options: "i",
            },
          },
          {
            sku: {
              $regex: search.trim(),
              $options: "i",
            },
          },
        ],
      };
    }

    /* ============================================
       GET PRODUCTS
    ============================================ */

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });

  } catch (error) {
    console.error(
      "GET PRODUCTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load products",
      error: error.message,
    });
  }
};


/* =========================================================
   UPDATE PRODUCT
========================================================= */

export const updateProduct = async (req, res) => {
  try {
    console.log("=================================");
    console.log("UPDATE PRODUCT REQUEST");
    console.log("=================================");

    console.log("PARAMS:", req.params);
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    const { id } = req.params;

    /* =====================================================
       VALIDATE ID
    ===================================================== */

    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required",
      });
    }

    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

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

      existingImages, // যেগুলো রাখতে চাই
    } = req.body;

    /* =====================================================
       REQUIRED
    ===================================================== */

    const productName = cleanString(name);
    const productSlug = cleanString(slug);

    if (!productName) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    if (!productSlug) {
      return res.status(400).json({
        success: false,
        message: "Product slug is required",
      });
    }

    if (
      price === undefined ||
      price === null ||
      price === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Price is required",
      });
    }

    if (
      stock === undefined ||
      stock === null ||
      stock === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Stock is required",
      });
    }

    /* =====================================================
       PARSE JSON
    ===================================================== */

    let parsedColors = [];
    let parsedSizes = [];
    let parsedRam = [];
    let parsedSpecifications = [];
    let parsedVariants = [];
    let parsedAdditionalCategories = [];
    let parsedExistingImages = [];

    try {
      parsedColors = parseJSON(colors, []);
      parsedSizes = parseJSON(sizes, []);
      parsedRam = parseJSON(ram, []);
      parsedSpecifications = parseJSON(specifications, []);
      parsedVariants = parseJSON(variants, []);
      parsedAdditionalCategories = parseJSON(additionalCategories, []);
      parsedExistingImages = parseJSON(existingImages, []);
    } catch (error) {
      console.error("JSON PARSE ERROR:", error);

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    /* =====================================================
       ARRAY VALIDATION
    ===================================================== */

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
        message: "Specifications must be an array",
      });
    }

    if (!Array.isArray(parsedVariants)) {
      return res.status(400).json({
        success: false,
        message: "Variants must be an array",
      });
    }

    if (!Array.isArray(parsedAdditionalCategories)) {
      return res.status(400).json({
        success: false,
        message: "Additional categories must be an array",
      });
    }

    if (!Array.isArray(parsedExistingImages)) {
      return res.status(400).json({
        success: false,
        message: "Existing images must be an array",
      });
    }

    /* =====================================================
       MAIN CATEGORY
    ===================================================== */

    if (!category || !isValidObjectId(category)) {
      return res.status(400).json({
        success: false,
        message: "Valid main category is required",
      });
    }

    const mainCategory = await MainCategory.findOne({
      _id: category,
      isActive: { $ne: false },
    }).lean();

    if (!mainCategory) {
      return res.status(400).json({
        success: false,
        message: "Main category not found or inactive",
      });
    }

    /* =====================================================
       SUB CATEGORY
    ===================================================== */

    let validatedSubCategory = null;

    if (subCategory) {
      if (!isValidObjectId(subCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid sub category",
        });
      }

      validatedSubCategory = await SubCategory.findOne({
        _id: subCategory,
        mainCategory: category,
        isActive: { $ne: false },
      }).lean();

      if (!validatedSubCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Sub category does not belong to selected main category",
        });
      }
    }

    /* =====================================================
       CHILD CATEGORY
    ===================================================== */

    let validatedChildCategory = null;

    if (childCategory) {
      if (!isValidObjectId(childCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid child category",
        });
      }

      if (!subCategory) {
        return res.status(400).json({
          success: false,
          message: "Sub category is required for child category",
        });
      }

      validatedChildCategory = await ChildCategory.findOne({
        _id: childCategory,
        subCategory: subCategory,
        mainCategory: category,
        isActive: { $ne: false },
      }).lean();

      if (!validatedChildCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Child category does not belong to selected sub category",
        });
      }
    }

    /* =====================================================
       SUB CHILD CATEGORY
    ===================================================== */

    let validatedSubChildCategory = null;

    if (subChildCategory) {
      if (!isValidObjectId(subChildCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid sub-child category",
        });
      }

      if (!childCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Child category is required for sub-child category",
        });
      }

      validatedSubChildCategory = await SubChildCategory.findOne({
        _id: subChildCategory,
        childCategory: childCategory,
        subCategory: subCategory,
        mainCategory: category,
        isActive: { $ne: false },
      }).lean();

      if (!validatedSubChildCategory) {
        return res.status(400).json({
          success: false,
          message:
            "Sub-child category does not belong to selected child category",
        });
      }
    }

    /* =====================================================
       ADDITIONAL CATEGORIES
    ===================================================== */

    const validAdditionalIds = parsedAdditionalCategories.filter(
      (id) => isValidObjectId(id)
    );

    const cleanAdditionalCategories = uniqueObjectIds(validAdditionalIds);

    /* =====================================================
       VARIANTS
    ===================================================== */

    for (const variant of parsedVariants) {
      if (
        !variant ||
        typeof variant !== "object" ||
        Array.isArray(variant)
      ) {
        return res.status(400).json({
          success: false,
          message: "Each variant must be an object",
        });
      }

      if (variant.stock !== undefined && variant.stock !== "") {
        variant.stock = Number(variant.stock);

        if (Number.isNaN(variant.stock) || variant.stock < 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid variant stock",
          });
        }
      }

      if (variant.price !== undefined && variant.price !== "") {
        variant.price = Number(variant.price);

        if (Number.isNaN(variant.price) || variant.price < 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid variant price",
          });
        }
      }

      if (variant.ram !== undefined && variant.ram !== null) {
        variant.ram = String(variant.ram).trim();
      }

      if (variant.storage !== undefined && variant.storage !== null) {
        variant.storage = String(variant.storage).trim();
      }

      if (variant.sku !== undefined && variant.sku !== null) {
        variant.sku = String(variant.sku).trim();
      }

      if (variant.color && typeof variant.color === "object") {
        variant.color = {
          name: String(variant.color.name || "").trim(),
          code: variant.color.code || "#000000",
          image: variant.color.image || "",
        };
      }
    }

    /* =====================================================
       DUPLICATE SLUG (except current product)
    ===================================================== */

    const slugExists = await Product.findOne({
      slug: productSlug,
      _id: { $ne: id },
    }).lean();

    if (slugExists) {
      return res.status(400).json({
        success: false,
        message: `Product with slug "${productSlug}" already exists`,
      });
    }

    /* =====================================================
       IMAGES
    ===================================================== */

    const productImageFiles = req.files?.images || [];
    const colorImageFiles = req.files?.colorImages || [];

    // নতুন আপলোড করা ইমেজ
    const newUploadedImages = productImageFiles.map((file) => file.path);

    // পুরনো ইমেজ যেগুলো রাখতে চাই + নতুন ইমেজ
    const finalImages = [
      ...parsedExistingImages.filter(Boolean),
      ...newUploadedImages,
    ];

    if (finalImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required",
      });
    }

    const uploadedColorImages = colorImageFiles.map((file) => file.path);

    /* =====================================================
       COLORS
    ===================================================== */

    // নতুন color image আসলে সেগুলো assign করো
    // existing color-এর image থাকলে সেটা রাখো
    let colorImageIndex = 0;

    const finalColors = parsedColors.map((color) => {
      let image = color?.existingImage || color?.image || "";

      // যদি এই color-এর জন্য নতুন image আসে
      if (color?.imageFile || (!image && uploadedColorImages[colorImageIndex])) {
        image = uploadedColorImages[colorImageIndex] || image;
        colorImageIndex++;
      }

      // যদি color-এ imageFile flag থাকে (frontend থেকে)
      if (color?.hasNewImage && uploadedColorImages[colorImageIndex]) {
        image = uploadedColorImages[colorImageIndex];
        colorImageIndex++;
      }

      return {
        name: cleanString(color?.name),
        code: color?.code || "#000000",
        image: image,
      };
    });

    /* =====================================================
       PRICE
    ===================================================== */

    const productPrice = Number(price);

    if (Number.isNaN(productPrice) || productPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product price",
      });
    }

    /* =====================================================
       DISCOUNT PRICE
    ===================================================== */

    const productDiscountPrice =
      discountPrice !== undefined &&
      discountPrice !== null &&
      discountPrice !== ""
        ? Number(discountPrice)
        : null;

    if (
      productDiscountPrice !== null &&
      (Number.isNaN(productDiscountPrice) || productDiscountPrice < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount price",
      });
    }

    if (
      productDiscountPrice !== null &&
      productDiscountPrice >= productPrice &&
      productPrice > 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Discount price must be lower than product price",
      });
    }

    /* =====================================================
       DISCOUNT %
    ===================================================== */

    let calculatedDiscountPercentage = 0;

    if (
      productDiscountPrice !== null &&
      productPrice > 0 &&
      productDiscountPrice < productPrice
    ) {
      calculatedDiscountPercentage =
        ((productPrice - productDiscountPrice) / productPrice) * 100;
    }

    let finalDiscountPercentage = Number(
      calculatedDiscountPercentage.toFixed(2)
    );

    if (discountPercentage !== undefined && discountPercentage !== "") {
      const manuallyEntered = Number(discountPercentage);

      if (
        Number.isNaN(manuallyEntered) ||
        manuallyEntered < 0 ||
        manuallyEntered > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid discount percentage",
        });
      }

      finalDiscountPercentage = manuallyEntered;
    }

    /* =====================================================
       STOCK
    ===================================================== */

    const productStock = Number(stock);

    if (Number.isNaN(productStock) || productStock < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock",
      });
    }

    /* =====================================================
       RATING
    ===================================================== */

    const productRating =
      rating !== undefined && rating !== "" ? Number(rating) : 0;

    if (
      Number.isNaN(productRating) ||
      productRating < 0 ||
      productRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 0 and 5",
      });
    }

    /* =====================================================
       UPDATE PRODUCT
    ===================================================== */

    existingProduct.name = productName;
    existingProduct.slug = productSlug;
    existingProduct.description = cleanString(description);
    existingProduct.shortDescription = cleanString(shortDescription);

    // 4 LEVEL CATEGORY
    existingProduct.category = category;
    existingProduct.subCategory = subCategory || null;
    existingProduct.childCategory = childCategory || null;
    existingProduct.subChildCategory = subChildCategory || null;

    // ADDITIONAL
    existingProduct.additionalCategories = cleanAdditionalCategories;

    // BRAND
    existingProduct.brand = cleanString(brand);

    // PRICE
    existingProduct.price = productPrice;
    existingProduct.discountPrice = productDiscountPrice;
    existingProduct.discountPercentage = finalDiscountPercentage;

    // STOCK
    existingProduct.stock = productStock;
    existingProduct.sku = cleanString(sku);

    // COLORS
    existingProduct.colors = finalColors;

    // SIZES
    existingProduct.sizes = uniqueStrings(parsedSizes);

    // RAM
    existingProduct.ram = uniqueStrings(parsedRam);

    // SPECIFICATIONS
    existingProduct.specifications = parsedSpecifications;

    // VARIANTS
    existingProduct.variants = parsedVariants;

    // RATING
    existingProduct.rating = productRating;

    // STATUS
    if (isActive !== undefined) {
      existingProduct.isActive = toBoolean(isActive);
    }

    if (isFeatured !== undefined) {
      existingProduct.isFeatured = toBoolean(isFeatured);
    }

    if (isNew !== undefined) {
      existingProduct.isNew = toBoolean(isNew);
    }

    if (isBestSeller !== undefined) {
      existingProduct.isBestSeller = toBoolean(isBestSeller);
    }

    // SEO
    existingProduct.metaTitle = cleanString(metaTitle);
    existingProduct.metaDescription = cleanString(metaDescription);

    // IMAGES
    existingProduct.images = finalImages;

    await existingProduct.save();

    console.log("PRODUCT UPDATED:", existingProduct._id);

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: existingProduct,
    });
  } catch (error) {
    console.error("=================================");
    console.error("UPDATE PRODUCT ERROR");
    console.error(error);
    console.error("=================================");

    if (error.code === 11000) {
      const duplicateField =
        Object.keys(error.keyPattern || {})[0] || "field";

      return res.status(400).json({
        success: false,
        message: `${duplicateField} already exists`,
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Product validation failed",
        errors: Object.values(error.errors).map((err) => ({
          field: err.path,
          message: err.message,
          value: err.value,
        })),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid value for ${error.path}`,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update product",
    });
  }
};


export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get product by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get product",
      error: error.message,
    });
  }
};