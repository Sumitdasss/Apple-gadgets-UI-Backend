import mongoose from "mongoose";
import Product from "../Model/Product.js";

import {
  MainCategory,
  SubCategory,
  ChildCategory,
  SubChildCategory,
} from "../Model/Catagori.js";

/* =========================================================
   CONFIGURATION
========================================================= */

const CACHE_TTL = 15_000;
const MAX_CACHE_ITEMS = 200;

const responseCache = new Map();

/* =========================================================
   CACHE HELPERS
========================================================= */

const getCached = (key) => {
  const cached = responseCache.get(key);

  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  // Refresh insertion order for simple LRU behavior
  responseCache.delete(key);
  responseCache.set(key, cached);

  return cached.data;
};

const setCached = (key, data) => {
  if (responseCache.has(key)) {
    responseCache.delete(key);
  }

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

export const clearProductCache = () => {
  responseCache.clear();
};

const sendCachedResponse = (req, res, next) => {
  if (req.method !== "GET") return next();

  const key = `products:${req.originalUrl}`;
  const cached = getCached(key);

  if (cached) {
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

  next();
};

// Use this middleware on product GET routes.
export const productCache = sendCachedResponse;

/* =========================================================
   COMMON HELPERS
========================================================= */

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

const isValidObjectId = (id) =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

const cleanString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const toBoolean = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

const uniqueStrings = (items = []) => [
  ...new Set(
    items
      .filter((item) => item !== undefined && item !== null)
      .map((item) => String(item).trim())
      .filter(Boolean),
  ),
];

const uniqueIds = (items = []) => [
  ...new Map(items.filter(Boolean).map((id) => [String(id), id])).values(),
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseArrayFields = (body, fields) => {
  const result = {};

  for (const field of fields) {
    result[field] = parseJSON(body[field], []);

    if (!Array.isArray(result[field])) {
      throw new Error(`${field} must be an array`);
    }
  }

  return result;
};

const parseNumber = (value, field, { min = 0, max = Infinity } = {}) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${field} is required`);
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`Invalid ${field}`);
  }

  return number;
};

const effectivePriceExpression = {
  $cond: [
    {
      $and: [
        { $ne: ["$discountPrice", null] },
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
  const { category, subCategory, childCategory, subChildCategory } = body;

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
      throw new Error("Invalid sub category");
    }

    const sub = await SubCategory.findOne({
      _id: subCategory,
      mainCategory: category,
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    if (!sub) {
      throw new Error("Invalid sub category parent");
    }
  }

  if (childCategory) {
    if (!subCategory) {
      throw new Error("Sub category is required for child category");
    }

    const child = await ChildCategory.findOne({
      _id: childCategory,
      subCategory,
      mainCategory: category,
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    if (!child) {
      throw new Error("Invalid child category parent");
    }
  }

  if (subChildCategory) {
    if (!childCategory) {
      throw new Error("Child category is required for sub-child category");
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

    if (!subChild) {
      throw new Error("Invalid sub-child category parent");
    }
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
  variants.map((variant) => {
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
      throw new Error("Each variant must be an object");
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
    if (result.sku != null) result.sku = cleanString(result.sku);

    if (result.color && typeof result.color === "object") {
      result.color = {
        name: cleanString(result.color.name),
        code: result.color.code || "#000000",
        image: result.color.image || "",
      };
    }

    return result;
  });

/* =========================================================
   SHARED PRODUCT SAVE HANDLER
========================================================= */

const saveProduct = async (req, res, isUpdate = false) => {
  try {
    const existingProduct = isUpdate
      ? await (async () => {
          const { id } = req.params;

          if (!isValidObjectId(id)) {
            throw new Error("Valid product ID is required");
          }

          const product = await Product.findById(id);

          if (!product) {
            const error = new Error("Product not found");
            error.statusCode = 404;
            throw error;
          }

          return product;
        })()
      : null;

    const body = req.body;

    const name = cleanString(body.name);
    const slug = cleanString(body.slug);

    if (!name) throw new Error("Product name is required");
    if (!slug) throw new Error("Product slug is required");

    const price = parseNumber(body.price, "price");

    const stock = parseNumber(body.stock, "stock");

    const discountPrice =
      body.discountPrice === undefined ||
      body.discountPrice === null ||
      body.discountPrice === ""
        ? null
        : parseNumber(body.discountPrice, "discount price");

    if (discountPrice !== null && discountPrice >= price && price > 0) {
      throw new Error("Discount price must be lower than product price");
    }

    const rating =
      body.rating === undefined || body.rating === ""
        ? 0
        : parseNumber(body.rating, "rating", { min: 0, max: 5 });

    const arrays = parseArrayFields(body, [
      "colors",
      "sizes",
      "ram",
      "specifications",
      "variants",
      "additionalCategories",
    ]);

    const parsedColors = arrays.colors;
    const parsedSizes = arrays.sizes;
    const parsedRam = arrays.ram;
    const parsedSpecifications = arrays.specifications;
    const parsedVariants = normalizeVariants(arrays.variants);

    const additionalCategories = arrays.additionalCategories;

    if (additionalCategories.some((id) => !isValidObjectId(id))) {
      throw new Error("Invalid additional category ID");
    }

    const cleanAdditionalCategories = uniqueIds(additionalCategories);

    const categories = await validateCategories(body);

    const duplicate = await Product.exists({
      slug,
      ...(isUpdate ? { _id: { $ne: existingProduct._id } } : {}),
    });

    if (duplicate) {
      throw new Error(`Product with slug "${slug}" already exists`);
    }

    const files = req.files || {};
    const newImages = (files.images || []).map((file) => file.path);
    const newColorImages = (files.colorImages || []).map((file) => file.path);

    const existingImages = isUpdate
      ? parseJSON(body.existingImages, existingProduct.images || [])
      : [];

    if (!Array.isArray(existingImages)) {
      throw new Error("Existing images must be an array");
    }

    // Keep only previously stored image URLs belonging to this product.
    const oldImages = existingProduct?.images || [];
    const retainedImages = existingImages.filter(
      (image) => typeof image === "string" && oldImages.includes(image),
    );

    const images = isUpdate ? [...retainedImages, ...newImages] : newImages;

    if (images.length === 0) {
      throw new Error("At least one product image is required");
    }

    let colorImageIndex = 0;

    const colors = parsedColors.map((color) => {
      let image = color?.existingImage || color?.image || "";

      if (
        color?.hasNewImage ||
        color?.imageFile ||
        (!image && newColorImages[colorImageIndex])
      ) {
        if (newColorImages[colorImageIndex]) {
          image = newColorImages[colorImageIndex];
          colorImageIndex += 1;
        }
      }

      return {
        name: cleanString(color?.name),
        code: color?.code || "#000000",
        image,
      };
    });

    const discountPercentage =
      discountPrice !== null && price > 0
        ? Number((((price - discountPrice) / price) * 100).toFixed(2))
        : 0;

    const manuallyEnteredDiscount =
      body.discountPercentage !== undefined && body.discountPercentage !== ""
        ? parseNumber(body.discountPercentage, "discount percentage", {
            min: 0,
            max: 100,
          })
        : discountPercentage;

    const productData = {
      name,
      slug,
      description: cleanString(body.description),
      shortDescription: cleanString(body.shortDescription),

      ...categories,
      additionalCategories: cleanAdditionalCategories,

      brand: cleanString(body.brand),

      price,
      discountPrice,
      discountPercentage: manuallyEnteredDiscount,

      stock,
      sku: cleanString(body.sku),

      colors,
      sizes: uniqueStrings(parsedSizes),
      ram: uniqueStrings(parsedRam),
      specifications: parsedSpecifications,
      variants: parsedVariants,

      rating,

      metaTitle: cleanString(body.metaTitle),
      metaDescription: cleanString(body.metaDescription),

      images,
    };

    if (!isUpdate || body.isActive !== undefined) {
      productData.isActive =
        body.isActive === undefined ? true : toBoolean(body.isActive);
    }

    if (!isUpdate || body.isFeatured !== undefined) {
      productData.isFeatured = toBoolean(body.isFeatured);
    }

    if (!isUpdate || body.isNew !== undefined) {
      productData.isNew = toBoolean(body.isNew);
    }

    if (!isUpdate || body.isBestSeller !== undefined) {
      productData.isBestSeller = toBoolean(body.isBestSeller);
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

export const addProduct = (req, res) => saveProduct(req, res, false);

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export const updateProduct = (req, res) => saveProduct(req, res, true);

/* =========================================================
   CATEGORY LOOKUP
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
      .findOne({ slug, isActive: { $ne: false } })
      .lean();

    if (category) {
      return { category, level: item.level };
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
  }

  if (level === "sub") {
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
  }

  if (level === "child") {
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
   GET ALL PRODUCTS
   GET /products/getALLproducts?page=1&limit=12
========================================================= */

export const getAllProduct = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      48,
      Math.max(1, parseInt(req.query.limit, 10) || 12),
    );
    const skip = (page - 1) * limit;

    const categoryQuery = cleanString(req.query.category).toLowerCase();
    const brandQuery = cleanString(req.query.brand);
    const stockQuery = cleanString(req.query.stock);
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
            price: { min: 0, max: 0 },
          },
        });
      }

      const { category, level } = found;
      const ids = await getCategoryIds(category, level);

      if (level === "main") {
        filter.$or = [
          { category: category._id },
          { additionalCategories: category._id },
        ];
      } else if (level === "sub") {
        filter.$or = [
          { subCategory: category._id },
          { childCategory: { $in: ids } },
          { subChildCategory: { $in: ids } },
          { additionalCategories: category._id },
        ];
      } else if (level === "child") {
        filter.$or = [
          { childCategory: category._id },
          { subChildCategory: { $in: ids } },
          { additionalCategories: category._id },
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

    if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
      const min =
        req.query.minPrice === undefined ? null : Number(req.query.minPrice);

      const max =
        req.query.maxPrice === undefined ? null : Number(req.query.maxPrice);

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
        conditions.push({ $gte: [effectivePriceExpression, min] });
      }

      if (max !== null) {
        conditions.push({ $lte: [effectivePriceExpression, max] });
      }

      filter.$expr = { $and: conditions };
    }

    if (stockQuery === "in-stock") filter.stock = { $gt: 0 };
    if (stockQuery === "out-of-stock") filter.stock = { $lte: 0 };

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

      // Build filter options from all matching products, not just this page.
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
        Array.isArray(value) ? value : value ? [value] : [],
      ),
      ...(facet.variants || []).flatMap((variants) =>
        Array.isArray(variants)
          ? variants.map((variant) => variant?.storage).filter(Boolean)
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

    const validPrices = (facet.prices || []).filter(Number.isFinite);

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
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      48,
      Math.max(1, parseInt(req.query.limit, 10) || 12),
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
