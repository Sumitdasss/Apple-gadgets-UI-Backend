import mongoose from "mongoose";
import Product from "../Model/Product.js";

import {
  MainCategory,
  SubCategory,
  ChildCategory,
  SubChildCategory,
} from "../Model/Catagori.js";

/* =========================================================
   CONFIGURATION + RESPONSE CACHE
========================================================= */

const CACHE_TTL = 15_000;
const MAX_CACHE_ITEMS = 200;
const responseCache = new Map();

const getCached = (key) => {
  const cached = responseCache.get(key);

  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  // Refresh insertion order (simple LRU).
  responseCache.delete(key);
  responseCache.set(key, cached);

  return cached.data;
};

const setCached = (key, data) => {
  responseCache.delete(key);

  while (responseCache.size >= MAX_CACHE_ITEMS) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey === undefined) break;
    responseCache.delete(oldestKey);
  }

  responseCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
};

export const clearProductCache = () => responseCache.clear();

export const productCache = (req, res, next) => {
  if (req.method !== "GET") return next();

  const key = `products:${req.originalUrl}`;
  const cached = getCached(key);

  if (cached !== null) {
    res.set("X-Cache", "HIT");
    return res.status(200).json(cached);
  }

  const originalJson = res.json.bind(res);

  res.json = (data) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      setCached(key, data);
      res.set("X-Cache", "MISS");
    }

    return originalJson(data);
  };

  return next();
};

/* =========================================================
   COMMON HELPERS
========================================================= */

const cleanString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const toBoolean = (value) =>
  value === true ||
  value === "true" ||
  value === 1 ||
  value === "1";

const isValidObjectId = (id) =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

const uniqueStrings = (items = []) => [
  ...new Set(
    (Array.isArray(items) ? items : [])
      .filter((item) => item !== undefined && item !== null)
      .map((item) => String(item).trim())
      .filter(Boolean),
  ),
];

const uniqueIds = (items = []) => [
  ...new Map(
    (Array.isArray(items) ? items : [])
      .filter(Boolean)
      .map((id) => [String(id), id]),
  ).values(),
];

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseJSON = (value, fallback = []) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Invalid JSON data");
  }
};

const parseArrayField = (body, field, fallback = []) => {
  const value = parseJSON(body[field], fallback);

  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }

  return value;
};

const parseNumber = (
  value,
  field,
  { min = 0, max = Infinity } = {},
) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${field} is required`);
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`Invalid ${field}`);
  }

  return number;
};

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const effectivePriceExpression = {
  $cond: [
    {
      $and: [
        { $ne: [{ $ifNull: ["$discountPrice", null] }, null] },
        { $lt: ["$discountPrice", "$price"] },
        { $gte: ["$discountPrice", 0] },
      ],
    },
    "$discountPrice",
    "$price",
  ],
};

const sortOptions = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "price-low": { price: 1, _id: 1 },
  "price-high": { price: -1, _id: -1 },
  rating: { rating: -1, createdAt: -1 },
};

/* =========================================================
   CATEGORY VALIDATION
========================================================= */

const validateCategories = async (body) => {
  const category = cleanString(body.category);
  const subCategory = cleanString(body.subCategory);
  const childCategory = cleanString(body.childCategory);
  const subChildCategory = cleanString(body.subChildCategory);

  if (!isValidObjectId(category)) {
    throw new Error("Valid main category is required");
  }

  const main = await MainCategory.findOne({
    _id: category,
    isActive: { $ne: false },
  })
    .select("_id")
    .lean();

  if (!main) {
    throw new Error("Main category not found or inactive");
  }

  if (subCategory) {
    if (!isValidObjectId(subCategory)) {
      throw new Error("Invalid sub category ID");
    }

    const sub = await SubCategory.findOne({
      _id: subCategory,
      mainCategory: category,
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    if (!sub) throw new Error("Invalid sub category parent");
  }

  if (childCategory) {
    if (!subCategory) {
      throw new Error("Sub category is required for child category");
    }

    if (!isValidObjectId(childCategory)) {
      throw new Error("Invalid child category ID");
    }

    const child = await ChildCategory.findOne({
      _id: childCategory,
      subCategory,
      mainCategory: category,
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    if (!child) throw new Error("Invalid child category parent");
  }

  if (subChildCategory) {
    if (!childCategory) {
      throw new Error("Child category is required for sub-child category");
    }

    if (!isValidObjectId(subChildCategory)) {
      throw new Error("Invalid sub-child category ID");
    }

    const subChild = await SubChildCategory.findOne({
      _id: subChildCategory,
      childCategory,
      subCategory,
      mainCategory: category,
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    if (!subChild) throw new Error("Invalid sub-child category parent");
  }

  return {
    category,
    subCategory: subCategory || null,
    childCategory: childCategory || null,
    subChildCategory: subChildCategory || null,
  };
};

/* =========================================================
   VARIANT VALIDATION
========================================================= */

const normalizeVariants = (variants) =>
  variants.map((variant, index) => {
    if (
      !variant ||
      typeof variant !== "object" ||
      Array.isArray(variant)
    ) {
      throw new Error(`Variant ${index + 1} must be an object`);
    }

    const result = { ...variant };

    if (result.stock !== undefined && result.stock !== "") {
      result.stock = parseNumber(result.stock, "variant stock");
    }

    if (result.price !== undefined && result.price !== "") {
      result.price = parseNumber(result.price, "variant price");
    }

    if (result.ram != null) result.ram = cleanString(result.ram);

    if (result.storage != null) {
      result.storage = cleanString(result.storage);
    }

    if (result.sku != null) {
      result.sku = cleanString(result.sku);
    }

    if (result.color && typeof result.color === "object") {
      result.color = {
        ...result.color,
        name: cleanString(result.color.name),
        code: cleanString(result.color.code) || "#000000",
        image: cleanString(result.color.image),
      };
    }

    return result;
  });

/* =========================================================
   SHARED ADD / UPDATE HANDLER
========================================================= */

const saveProduct = async (req, res, isUpdate = false) => {
  try {
    let existingProduct = null;

    if (isUpdate) {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Valid product ID is required",
        });
      }

      existingProduct = await Product.findById(id);

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }
    }

    const body = req.body || {};

    // Preserve existing scalar values when a field is omitted on update.
    const name = cleanString(
      hasOwn(body, "name") ? body.name : existingProduct?.name,
    );

    const slug = cleanString(
      hasOwn(body, "slug") ? body.slug : existingProduct?.slug,
    );

    if (!name) throw new Error("Product name is required");
    if (!slug) throw new Error("Product slug is required");

    const price = parseNumber(
      hasOwn(body, "price") ? body.price : existingProduct?.price,
      "price",
    );

    const stock = parseNumber(
      hasOwn(body, "stock") ? body.stock : existingProduct?.stock,
      "stock",
    );

    const rawDiscountPrice = hasOwn(body, "discountPrice")
      ? body.discountPrice
      : existingProduct?.discountPrice;

    const discountPrice =
      rawDiscountPrice === undefined ||
      rawDiscountPrice === null ||
      rawDiscountPrice === ""
        ? null
        : parseNumber(rawDiscountPrice, "discount price");

    if (discountPrice !== null && discountPrice >= price) {
      throw new Error("Discount price must be lower than product price");
    }

    const rating = parseNumber(
      hasOwn(body, "rating")
        ? body.rating
        : existingProduct?.rating ?? 0,
      "rating",
      { min: 0, max: 5 },
    );

    const colorsInput = parseArrayField(
      body,
      "colors",
      existingProduct?.colors?.map((item) =>
        item?.toObject ? item.toObject() : item,
      ) || [],
    );

    const sizesInput = parseArrayField(
      body,
      "sizes",
      existingProduct?.sizes || [],
    );

    const ramInput = parseArrayField(
      body,
      "ram",
      existingProduct?.ram || [],
    );

    const specifications = parseArrayField(
      body,
      "specifications",
      existingProduct?.specifications || [],
    );

    const variantsInput = parseArrayField(
      body,
      "variants",
      existingProduct?.variants?.map((item) =>
        item?.toObject ? item.toObject() : item,
      ) || [],
    );

    const additionalCategoriesInput = parseArrayField(
      body,
      "additionalCategories",
      existingProduct?.additionalCategories || [],
    );

    const variants = normalizeVariants(variantsInput);

    if (
      additionalCategoriesInput.some(
        (id) => !isValidObjectId(String(id)),
      )
    ) {
      throw new Error("Invalid additional category ID");
    }

    const additionalCategories = uniqueIds(additionalCategoriesInput);

    const categoryBody = {
      category: hasOwn(body, "category")
        ? body.category
        : existingProduct?.category?.toString(),

      subCategory: hasOwn(body, "subCategory")
        ? body.subCategory
        : existingProduct?.subCategory?.toString() || "",

      childCategory: hasOwn(body, "childCategory")
        ? body.childCategory
        : existingProduct?.childCategory?.toString() || "",

      subChildCategory: hasOwn(body, "subChildCategory")
        ? body.subChildCategory
        : existingProduct?.subChildCategory?.toString() || "",
    };

    const categories = await validateCategories(categoryBody);

    const duplicate = await Product.exists({
      slug,
      ...(isUpdate ? { _id: { $ne: existingProduct._id } } : {}),
    });

    if (duplicate) {
      throw new Error(`Product with slug "${slug}" already exists`);
    }

    const files = req.files || {};

    const newImages = (files.images || []).map((file) => file.path);

    const newColorImages = (files.colorImages || []).map(
      (file) => file.path,
    );

    const oldImages = Array.isArray(existingProduct?.images)
      ? existingProduct.images
      : [];

    const submittedExistingImages = parseJSON(
      body.existingImages,
      oldImages,
    );

    if (!Array.isArray(submittedExistingImages)) {
      throw new Error("Existing images must be an array");
    }

    // Only retain URLs already belonging to this product.
    const retainedImages = submittedExistingImages.filter(
      (image) => typeof image === "string" && oldImages.includes(image),
    );

    const images = isUpdate
      ? [...retainedImages, ...newImages]
      : newImages;

    if (images.length === 0) {
      throw new Error("At least one product image is required");
    }

    // Match uploaded color images to colors in the submitted order.
    let colorImageIndex = 0;

    const colors = colorsInput.map((color) => {
      const safeColor =
        color && typeof color === "object" && !Array.isArray(color)
          ? color
          : { name: cleanString(color) };

      let image = cleanString(
        safeColor.existingImage || safeColor.image || "",
      );

      const needsNewImage =
        toBoolean(safeColor.hasNewImage) ||
        toBoolean(safeColor.imageFile) ||
        !image;

      if (needsNewImage && newColorImages[colorImageIndex]) {
        image = newColorImages[colorImageIndex];
        colorImageIndex += 1;
      }

      return {
        ...safeColor,
        name: cleanString(safeColor.name),
        code: cleanString(safeColor.code) || "#000000",
        image,
      };
    });

    const calculatedDiscountPercentage =
      discountPrice !== null && price > 0
        ? Number((((price - discountPrice) / price) * 100).toFixed(2))
        : 0;

    const discountPercentage =
      hasOwn(body, "discountPercentage") &&
      body.discountPercentage !== ""
        ? parseNumber(body.discountPercentage, "discount percentage", {
            min: 0,
            max: 100,
          })
        : calculatedDiscountPercentage;

let keyFeatures = [];

try {
  keyFeatures = req.body.keyFeatures
    ? JSON.parse(req.body.keyFeatures)
    : [];
} catch {
  return res.status(400).json({
    success: false,
    message: "Invalid keyFeatures format",
  });
}



    const productData = {
      name,
      slug,

      description: cleanString(
        hasOwn(body, "description")
          ? body.description
          : existingProduct?.description,
      ),

      shortDescription: cleanString(
        hasOwn(body, "shortDescription")
          ? body.shortDescription
          : existingProduct?.shortDescription,
      ),

      ...categories,
      additionalCategories,

      brand: cleanString(
        hasOwn(body, "brand") ? body.brand : existingProduct?.brand,
      ),

      price,
      discountPrice,
      discountPercentage,

      stock,

      sku: cleanString(
        hasOwn(body, "sku") ? body.sku : existingProduct?.sku,
      ),

      colors,
      sizes: uniqueStrings(sizesInput),
      ram: uniqueStrings(ramInput),
      specifications,
      keyFeatures,
      variants,

      rating,

      metaTitle: cleanString(
        hasOwn(body, "metaTitle")
          ? body.metaTitle
          : existingProduct?.metaTitle,
      ),

      metaDescription: cleanString(
        hasOwn(body, "metaDescription")
          ? body.metaDescription
          : existingProduct?.metaDescription,
      ),

      images,
    };

    const booleanFields = [
      ["isActive", true],
      ["isFeatured", false],
      ["isNew", false],
      ["isBestSeller", false],
    ];

    for (const [field, defaultValue] of booleanFields) {
      if (!isUpdate || hasOwn(body, field)) {
        productData[field] = hasOwn(body, field)
          ? toBoolean(body[field])
          : defaultValue;
      }
    }

    let product;

    if (isUpdate) {
      existingProduct.set(productData);
      product = await existingProduct.save();
    } else {
      product = await Product.create(productData);
    }

    clearProductCache();

    return res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate
        ? "Product updated successfully"
        : "Product added successfully",
      product,
    });
  } catch (error) {
    console.error(
      isUpdate ? "UPDATE PRODUCT ERROR:" : "ADD PRODUCT ERROR:",
      error,
    );

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";

      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Product validation failed",
        errors: Object.values(error.errors).map((item) => ({
          field: item.path,
          message: item.message,
          value: item.value,
        })),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid value for ${error.path}`,
      });
    }

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Product operation failed",
    });
  }
};

/* =========================================================
   ADD PRODUCT
========================================================= */

export const addProduct = (req, res) =>
  saveProduct(req, res, false);

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export const updateProduct = (req, res) =>
  saveProduct(req, res, true);

/* =========================================================
   CATEGORY LOOKUP HELPERS
========================================================= */

const findCategoryBySlug = async (slug) => {
  const models = [
    { model: MainCategory, level: "main" },
    { model: SubCategory, level: "sub" },
    { model: ChildCategory, level: "child" },
    { model: SubChildCategory, level: "subChild" },
  ];

  for (const item of models) {
    const category = await item.model
      .findOne({
        slug,
        isActive: { $ne: false },
      })
      .lean();

    if (category) {
      return {
        category,
        level: item.level,
      };
    }
  }

  return null;
};

const getCategoryIds = async (category, level) => {
  const ids = [category._id];

  if (level === "main") {
    const [subs, children, subChildren] = await Promise.all([
      SubCategory.find({
        mainCategory: category._id,
        isActive: { $ne: false },
      })
        .select("_id")
        .lean(),

      ChildCategory.find({
        mainCategory: category._id,
        isActive: { $ne: false },
      })
        .select("_id")
        .lean(),

      SubChildCategory.find({
        mainCategory: category._id,
        isActive: { $ne: false },
      })
        .select("_id")
        .lean(),
    ]);

    ids.push(
      ...subs.map((item) => item._id),
      ...children.map((item) => item._id),
      ...subChildren.map((item) => item._id),
    );
  } else if (level === "sub") {
    const [children, subChildren] = await Promise.all([
      ChildCategory.find({
        subCategory: category._id,
        isActive: { $ne: false },
      })
        .select("_id")
        .lean(),

      SubChildCategory.find({
        subCategory: category._id,
        isActive: { $ne: false },
      })
        .select("_id")
        .lean(),
    ]);

    ids.push(
      ...children.map((item) => item._id),
      ...subChildren.map((item) => item._id),
    );
  } else if (level === "child") {
    const subChildren = await SubChildCategory.find({
      childCategory: category._id,
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    ids.push(...subChildren.map((item) => item._id));
  }

  return uniqueIds(ids);
};

/* =========================================================
   GET ALL PRODUCTS WITH CATEGORY / FILTERS / PAGINATION

   GET /products/getALLproducts?page=1&limit=12
========================================================= */

export const getAllProduct = async (req, res) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1,
    );

    const limit = Math.min(
      48,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 12),
    );

    const skip = (page - 1) * limit;

    const categoryQuery = cleanString(req.query.category).toLowerCase();
    const brandQuery = cleanString(req.query.brand);
    const stockQuery = cleanString(req.query.stock).toLowerCase();
    const sortQuery = cleanString(req.query.sort) || "newest";

    const filter = {};

    if (categoryQuery) {
      const found = await findCategoryBySlug(categoryQuery);

      if (!found) {
        return res.status(200).json({
          success: true,
          count: 0,
          total: 0,
          page,
          limit,
          totalPages: 0,
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

      const { category, level } = found;
      const ids = await getCategoryIds(category, level);

      if (level === "main") {
        filter.$or = [
          { category: { $in: ids } },
          { subCategory: { $in: ids } },
          { childCategory: { $in: ids } },
          { subChildCategory: { $in: ids } },
          { additionalCategories: { $in: ids } },
        ];
      } else if (level === "sub") {
        filter.$or = [
          { subCategory: category._id },
          { childCategory: { $in: ids } },
          { subChildCategory: { $in: ids } },
          { additionalCategories: { $in: ids } },
        ];
      } else if (level === "child") {
        filter.$or = [
          { childCategory: category._id },
          { subChildCategory: { $in: ids } },
          { additionalCategories: { $in: ids } },
        ];
      } else {
        filter.$or = [
          { subChildCategory: category._id },
          { additionalCategories: category._id },
        ];
      }
    }

    if (brandQuery) {
      filter.brand = {
        $in: brandQuery
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
    }

    if (
      req.query.minPrice !== undefined ||
      req.query.maxPrice !== undefined
    ) {
      const min =
        req.query.minPrice === undefined
          ? null
          : Number(req.query.minPrice);

      const max =
        req.query.maxPrice === undefined
          ? null
          : Number(req.query.maxPrice);

      if (
        (min !== null && (!Number.isFinite(min) || min < 0)) ||
        (max !== null && (!Number.isFinite(max) || max < 0)) ||
        (min !== null && max !== null && min > max)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid price range",
        });
      }

      const conditions = [];

      if (min !== null) {
        conditions.push({
          $gte: [effectivePriceExpression, min],
        });
      }

      if (max !== null) {
        conditions.push({
          $lte: [effectivePriceExpression, max],
        });
      }

      filter.$expr = {
        $and: conditions,
      };
    }

    if (stockQuery === "in-stock") {
      filter.stock = { $gt: 0 };
    }

    if (stockQuery === "out-of-stock") {
      filter.stock = { $lte: 0 };
    }

    const sortOption = sortOptions[sortQuery] || sortOptions.newest;

    const [products, total, facetRows] = await Promise.all([
      Product.find(filter)
        .select("-__v")
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .populate("childCategory", "name slug")
        .populate("subChildCategory", "name slug")
        .populate("additionalCategories", "name slug")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),

      Product.countDocuments(filter),

      // Build filter options from all matching products.
      Product.aggregate([
        { $match: filter },
        {
          $project: {
            brand: 1,
            series: 1,
            displaySize: 1,
            display: 1,
            screenSize: 1,
            processor: 1,
            colors: 1,
            variants: 1,
            storage: 1,
            price: 1,
            discountPrice: 1,
            effectivePrice: effectivePriceExpression,
          },
        },
        {
          $group: {
            _id: null,
            brands: { $addToSet: "$brand" },
            series: { $addToSet: "$series" },

            displaySizes: {
              $addToSet: {
                $ifNull: [
                  "$displaySize",
                  { $ifNull: ["$display", "$screenSize"] },
                ],
              },
            },

            processors: { $addToSet: "$processor" },
            colors: { $push: "$colors" },
            variants: { $push: "$variants" },
            storageFields: { $push: "$storage" },
            prices: { $push: "$effectivePrice" },
          },
        },
      ]),
    ]);

    const facet = facetRows[0] || {};

    const storageValues = [
      ...(facet.storageFields || []).flatMap((value) =>
        Array.isArray(value)
          ? value
          : value
            ? [value]
            : [],
      ),

      ...(facet.variants || []).flatMap((variants) =>
        Array.isArray(variants)
          ? variants
              .map((variant) => variant?.storage)
              .filter(Boolean)
          : [],
      ),
    ];

    const colorValues = (facet.colors || []).flatMap((colors) =>
      Array.isArray(colors)
        ? colors.map((color) =>
            typeof color === "string" ? color : color?.name,
          )
        : [],
    );

    const validPrices = (facet.prices || []).filter(
      (price) =>
        typeof price === "number" && Number.isFinite(price),
    );

    const selected = categoryQuery
      ? await findCategoryBySlug(categoryQuery)
      : null;

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      products,

      category: selected
        ? {
            name: selected.category.name,
            slug: selected.category.slug,
            mainCategory: selected.category.mainCategory || null,
            subCategory: selected.category.subCategory || null,
            childCategory: selected.category.childCategory || null,
          }
        : null,

      filters: {
        brands: uniqueStrings(facet.brands || []),
        series: uniqueStrings(facet.series || []),
        displaySizes: uniqueStrings(facet.displaySizes || []),
        storage: uniqueStrings(storageValues),
        processors: uniqueStrings(facet.processors || []),
        colors: uniqueStrings(colorValues),

        price: {
          min: validPrices.length ? Math.min(...validPrices) : 0,
          max: validPrices.length ? Math.max(...validPrices) : 0,
        },
      },
    });
  } catch (error) {
    console.error("GET ALL PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get products",
    });
  }
};

/* =========================================================
   GET PRODUCTS / SEARCH

   GET /products?search=iphone&page=1&limit=12
========================================================= */

export const getProducts = async (req, res) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1,
    );

    const limit = Math.min(
      48,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 12),
    );

    const skip = (page - 1) * limit;
    const search = cleanString(req.query.search);
    const filter = {};

    if (search) {
      const safeSearch = escapeRegex(search);

      filter.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { slug: { $regex: safeSearch, $options: "i" } },
        { sku: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select("-__v")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      products,
    });
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load products",
    });
  }
};

/* =========================================================
   GET PRODUCT BY ID
========================================================= */

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(id)
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .populate("childCategory", "name slug")
      .populate("subChildCategory", "name slug")
      .populate("additionalCategories", "name slug")
      .lean();

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
    console.error("GET PRODUCT BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get product",
    });
  }
};

/* =========================================================
   DELETE PRODUCT
========================================================= */

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    clearProductCache();

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: {
        id: product._id,
      },
    });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};