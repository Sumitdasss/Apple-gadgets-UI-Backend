
import mongoose from "mongoose";
import Product from "../Model/Product.js";
import Review from "../Model/Review.js";

import {
  MainCategory,
  SubCategory,
  ChildCategory,
  SubChildCategory,
} from "../Model/Catagori.js";

import {
  getProductCache,
  setProductCache,
  clearProductCache,
} from "../utils/productCache.js";

/* =====================================================
   1. REDIS CACHE HELPERS
===================================================== */

const getCachedResponse = async (res, key) => {
  const cached = await getProductCache(key);

  if (cached !== null) {
    res.set("X-Cache", "HIT");
    return { hit: true, data: cached };
  }

  return { hit: false, data: null };
};

const sendCachedResponse = async (res, key, data, status = 200) => {
  await setProductCache(key, data);
  res.set("X-Cache", "MISS");
  return res.status(status).json(data);
};

/* =====================================================
   2. COMMON HELPERS
===================================================== */

const cleanString = (value) =>
  value == null ? "" : String(value).trim();

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

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
      .filter((item) => item != null)
      .map((item) => String(item).trim())
      .filter(Boolean)
  ),
];

const uniqueIds = (items = []) => [
  ...new Map(
    (Array.isArray(items) ? items : [])
      .filter(Boolean)
      .map((id) => [String(id), id])
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

const getOldArray = (product, field) => {
  const value = product?.[field];

  if (!Array.isArray(value)) return [];

  return value.map((item) =>
    item?.toObject ? item.toObject() : item
  );
};

/* =====================================================
   3. PRICE AND SORT HELPERS
===================================================== */

const effectivePriceExpression = {
  $cond: [
    {
      $and: [
        {
          $ne: [
            { $ifNull: ["$discountPrice", null] },
            null,
          ],
        },
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

/* =====================================================
   4. CATEGORY VALIDATION
===================================================== */

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
  }).select("_id").lean();

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
    }).select("_id").lean();

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
    }).select("_id").lean();

    if (!child) throw new Error("Invalid child category parent");
  }

  if (subChildCategory) {
    if (!childCategory) {
      throw new Error(
        "Child category is required for sub-child category"
      );
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
    }).select("_id").lean();

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

/* =====================================================
   5. VARIANT VALIDATION
===================================================== */

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

    if (result.costPrice !== undefined && result.costPrice !== "") {
  result.costPrice = parseNumber(result.costPrice, "variant costPrice");
} else {
  result.costPrice = 0;
}

    if (result.ram != null) result.ram = cleanString(result.ram);
    if (result.storage != null) {
      result.storage = cleanString(result.storage);
    }
    if (result.sku != null) result.sku = cleanString(result.sku);

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

/* =====================================================
   6. ADD AND UPDATE PRODUCT
===================================================== */

const saveProduct = async (req, res, isUpdate = false) => {
  try {
    const body = req.body || {};
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

    const getValue = (field, fallback = "") =>
      hasOwn(body, field)
        ? body[field]
        : existingProduct?.[field] ?? fallback;

    const name = cleanString(getValue("name"));
    const slug = cleanString(getValue("slug"));

    if (!name) throw new Error("Product name is required");
    if (!slug) throw new Error("Product slug is required");

    const price = parseNumber(getValue("price"), "price");
    const stock = parseNumber(getValue("stock"), "stock");
    const costPrice = parseNumber(getValue("costPrice"), "costPrice");

    const rawDiscountPrice = getValue("discountPrice", null);

    const discountPrice =
      rawDiscountPrice === null ||
      rawDiscountPrice === undefined ||
      rawDiscountPrice === ""
        ? null
        : parseNumber(rawDiscountPrice, "discount price");

    if (discountPrice !== null && discountPrice >= price) {
      throw new Error(
        "Discount price must be lower than product price"
      );
    }

    const rating = parseNumber(getValue("rating", 0), "rating", {
      min: 0,
      max: 5,
    });

    const colorsInput = parseArrayField(
      body,
      "colors",
      getOldArray(existingProduct, "colors")
    );

    const sizesInput = parseArrayField(
      body,
      "sizes",
      getOldArray(existingProduct, "sizes")
    );

    const ramInput = parseArrayField(
      body,
      "ram",
      getOldArray(existingProduct, "ram")
    );

    const specifications = parseArrayField(
      body,
      "specifications",
      getOldArray(existingProduct, "specifications")
    );

    const keyFeatures = parseArrayField(
      body,
      "keyFeatures",
      getOldArray(existingProduct, "keyFeatures")
    );

    const descriptionSectionsInput = parseArrayField(
      body,
      "descriptionSections",
      getOldArray(existingProduct, "descriptionSections")
    );

    const variantsInput = parseArrayField(
      body,
      "variants",
      getOldArray(existingProduct, "variants")
    );

    const additionalCategoriesInput = parseArrayField(
      body,
      "additionalCategories",
      getOldArray(existingProduct, "additionalCategories")
    );

    const variants = normalizeVariants(variantsInput);

    if (
      additionalCategoriesInput.some(
        (id) => !isValidObjectId(String(id))
      )
    ) {
      throw new Error("Invalid additional category ID");
    }

    const additionalCategories = uniqueIds(
      additionalCategoriesInput
    );

    const categories = await validateCategories({
      category: getValue(
        "category",
        existingProduct?.category?.toString() || ""
      ),
      subCategory: getValue(
        "subCategory",
        existingProduct?.subCategory?.toString() || ""
      ),
      childCategory: getValue(
        "childCategory",
        existingProduct?.childCategory?.toString() || ""
      ),
      subChildCategory: getValue(
        "subChildCategory",
        existingProduct?.subChildCategory?.toString() || ""
      ),
    });

    const duplicate = await Product.exists({
      slug,
      ...(isUpdate
        ? { _id: { $ne: existingProduct._id } }
        : {}),
    });

    if (duplicate) {
      throw new Error(`Product with slug "${slug}" already exists`);
    }

    const files = req.files || {};

    const newImages = (files.images || []).map((file) => file.path);
    const newColorImages = (files.colorImages || []).map(
      (file) => file.path
    );
    const newDescriptionSectionImages = (
      files.descriptionSectionImages || []
    ).map((file) => file.path);

    const oldImages = Array.isArray(existingProduct?.images)
      ? existingProduct.images
      : [];

    const submittedExistingImages = parseJSON(
      body.existingImages,
      oldImages
    );

    if (!Array.isArray(submittedExistingImages)) {
      throw new Error("Existing images must be an array");
    }

    const retainedImages = submittedExistingImages.filter(
      (image) =>
        typeof image === "string" && oldImages.includes(image)
    );

    const images = isUpdate
      ? [...retainedImages, ...newImages]
      : newImages;

    if (images.length === 0) {
      throw new Error("At least one product image is required");
    }

    let colorImageIndex = 0;

    const colors = colorsInput.map((color) => {
      const safeColor =
        color &&
        typeof color === "object" &&
        !Array.isArray(color)
          ? color
          : { name: cleanString(color) };

      let image = cleanString(
        safeColor.existingImage || safeColor.image || ""
      );

      const needsNewImage =
        toBoolean(safeColor.hasNewImage) ||
        toBoolean(safeColor.imageFile) ||
        !image;

      if (needsNewImage && newColorImages[colorImageIndex]) {
        image = newColorImages[colorImageIndex];
        colorImageIndex++;
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
        ? Number(
            (((price - discountPrice) / price) * 100).toFixed(2)
          )
        : 0;

    const discountPercentage =
      hasOwn(body, "discountPercentage") &&
      body.discountPercentage !== ""
        ? parseNumber(body.discountPercentage, "discount percentage", {
            min: 0,
            max: 100,
          })
        : calculatedDiscountPercentage;

    const productData = {
      name,
      slug,
      description: cleanString(getValue("description")),
      shortDescription: cleanString(
        getValue("shortDescription")
      ),
      ...categories,
      additionalCategories,
      brand: cleanString(getValue("brand")),
      price,
      discountPrice,
      discountPercentage,
      stock,
      costPrice,
      sku: cleanString(getValue("sku")),
      colors,
      sizes: uniqueStrings(sizesInput),
      ram: uniqueStrings(ramInput),
      specifications,
      keyFeatures,

      descriptionSections: descriptionSectionsInput.map(
        (section) => ({
          title: cleanString(section.title),
          description: cleanString(section.description),
          image:
            section.imageIndex !== null &&
            section.imageIndex !== undefined &&
            newDescriptionSectionImages[section.imageIndex]
              ? newDescriptionSectionImages[section.imageIndex]
              : cleanString(section.image || ""),
        })
      ),

      variants,
      rating,
      metaTitle: cleanString(getValue("metaTitle")),
      metaDescription: cleanString(
        getValue("metaDescription")
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

    await clearProductCache();

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
      error
    );

    if (error.code === 11000) {
      const field =
        Object.keys(error.keyPattern || {})[0] || "field";

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


/* =====================================================
   16. GET PRODUCT COSTS FOR PROFIT REPORT
===================================================== */

export const getProductCostsForReport = async (req, res) => {
  try {
    const products = await Product.find({})
      .select("_id name sku costPrice variants")
      .lean();

    const result = products.map((product) => ({
      _id: String(product._id),
      name: product.name || "",
      sku: product.sku || "",
      costPrice:
        Number.isFinite(Number(product.costPrice)) &&
        product.costPrice !== null &&
        product.costPrice !== ""
          ? Number(product.costPrice)
          : null,
      variants: (product.variants || []).map((variant) => ({
        _id: variant._id ? String(variant._id) : "",
        sku: variant.sku || "",
        ram: variant.ram || "",
        storage: variant.storage || "",
        costPrice:
          variant.costPrice !== undefined &&
          variant.costPrice !== null &&
          variant.costPrice !== "" &&
          Number.isFinite(Number(variant.costPrice))
            ? Number(variant.costPrice)
            : null,
      })),
    }));

    return res.status(200).json({
      success: true,
      count: result.length,
      products: result,
    });
  } catch (error) {
    console.error("GET PRODUCT COSTS FOR REPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product costs for report",
    });
  }
};



export const addProduct = (req, res) =>
  saveProduct(req, res, false);

export const updateProduct = (req, res) =>
  saveProduct(req, res, true);

/* =====================================================
   7. CATEGORY HELPERS
===================================================== */

const findCategoryBySlug = async (slug) => {
  const categoryModels = [
    { model: MainCategory, level: "main" },
    { model: SubCategory, level: "sub" },
    { model: ChildCategory, level: "child" },
    { model: SubChildCategory, level: "subChild" },
  ];

  for (const item of categoryModels) {
    const category = await item.model.findOne({
      slug,
      isActive: { $ne: false },
    }).lean();

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
      }).select("_id").lean(),

      ChildCategory.find({
        mainCategory: category._id,
        isActive: { $ne: false },
      }).select("_id").lean(),

      SubChildCategory.find({
        mainCategory: category._id,
        isActive: { $ne: false },
      }).select("_id").lean(),
    ]);

    ids.push(
      ...subs.map((item) => item._id),
      ...children.map((item) => item._id),
      ...subChildren.map((item) => item._id)
    );
  }

  if (level === "sub") {
    const [children, subChildren] = await Promise.all([
      ChildCategory.find({
        subCategory: category._id,
        isActive: { $ne: false },
      }).select("_id").lean(),

      SubChildCategory.find({
        subCategory: category._id,
        isActive: { $ne: false },
      }).select("_id").lean(),
    ]);

    ids.push(
      ...children.map((item) => item._id),
      ...subChildren.map((item) => item._id)
    );
  }

  if (level === "child") {
    const subChildren = await SubChildCategory.find({
      childCategory: category._id,
      isActive: { $ne: false },
    }).select("_id").lean();

    ids.push(...subChildren.map((item) => item._id));
  }

  return uniqueIds(ids);
};

const applyCategoryFilter = async (filter, slug) => {
  const found = await findCategoryBySlug(slug);

  if (!found) return null;

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

  return found;
};

const emptyProductListResponse = (page, limit, message) => ({
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
  ...(message ? { message } : {}),
});

/* =====================================================
   8. GET ALL PRODUCTS WITH FILTERS
===================================================== */

export const getAllProduct = async (req, res) => {
  try {
    const cacheKey = `all:${JSON.stringify(req.query)}`;
    const cached = await getCachedResponse(res, cacheKey);

    if (cached.hit) {
      return res.status(200).json(cached.data);
    }

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      48,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 12)
    );

    const skip = (page - 1) * limit;
    const categoryQuery = cleanString(req.query.category).toLowerCase();
    const brandQuery = cleanString(req.query.brand);
    const stockQuery = cleanString(req.query.stock).toLowerCase();
    const offerQuery = cleanString(req.query.offer).toLowerCase();
    const sortQuery = cleanString(req.query.sort) || "newest";

    const filter = {};

    if (categoryQuery) {
      const found = await applyCategoryFilter(filter, categoryQuery);

      if (!found) {
        return sendCachedResponse(
          res,
          cacheKey,
          emptyProductListResponse(page, limit),
          200
        );
      }
    }

    if (brandQuery) {
      filter.brand = {
        $in: brandQuery.split(",").map((brand) => brand.trim()).filter(Boolean),
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
        conditions.push({ $gte: [effectivePriceExpression, min] });
      }

      if (max !== null) {
        conditions.push({ $lte: [effectivePriceExpression, max] });
      }

      filter.$expr = { $and: conditions };
    }

    if (stockQuery === "in-stock") {
      filter.stock = { $gt: 0 };
    }

    if (stockQuery === "out-of-stock") {
      filter.stock = { $lte: 0 };
    }

    if (["true", "1", "yes"].includes(offerQuery)) {
      const offerConditions = [
        { $lt: ["$discountPrice", "$price"] },
        { $gt: ["$discountPrice", 0] },
      ];

      filter.$expr = filter.$expr
        ? { $and: [filter.$expr, ...offerConditions] }
        : { $and: offerConditions };
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
        Array.isArray(value) ? value : value ? [value] : []
      ),
      ...(facet.variants || []).flatMap((variants) =>
        Array.isArray(variants)
          ? variants.map((variant) => variant?.storage).filter(Boolean)
          : []
      ),
    ];

    const colorValues = (facet.colors || []).flatMap((colors) =>
      Array.isArray(colors)
        ? colors.map((color) =>
            typeof color === "string" ? color : color?.name
          )
        : []
    );

    const validPrices = (facet.prices || []).filter(
      (price) => typeof price === "number" && Number.isFinite(price)
    );

    const selected = categoryQuery
      ? await findCategoryBySlug(categoryQuery)
      : null;

    const response = {
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
    };

    return sendCachedResponse(res, cacheKey, response);
  } catch (error) {
    console.error("GET ALL PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get products",
    });
  }
};

/* =====================================================
   9. SEARCH PRODUCTS
===================================================== */

export const getProducts = async (req, res) => {
  try {
    const cacheKey = `search:${JSON.stringify(req.query)}`;
    const cached = await getCachedResponse(res, cacheKey);

    if (cached.hit) {
      return res.status(200).json(cached.data);
    }

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      48,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 12)
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

    const response = {
      success: true,
      count: products.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      products,
    };

    return sendCachedResponse(res, cacheKey, response);
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load products",
    });
  }
};

/* =====================================================
   10. GET PRODUCT BY ID
===================================================== */

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const cacheKey = `by-id:${id}`;
    const cached = await getCachedResponse(res, cacheKey);

    if (cached.hit) {
      return res.status(200).json(cached.data);
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

    return sendCachedResponse(res, cacheKey, {
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

/* =====================================================
   11. DELETE PRODUCT
===================================================== */

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

    await clearProductCache();

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: { id: product._id },
    });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};

/* =====================================================
   12. CREATE REVIEW
===================================================== */

export const createReview = async (req, res) => {
  try {
    const { productId } = req.params;

    const {
      productSlug,
      productName,
      name,
      userName,
      rating,
      review,
      comment,
    } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const cleanName = String(name || userName || "").trim();
    const cleanReview = String(review || comment || "").trim();
    const numericRating = Number(rating);

    if (!cleanName || cleanName.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name is required (maximum 80 characters).",
      });
    }

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5.",
      });
    }

    if (!cleanReview || cleanReview.length > 3000) {
      return res.status(400).json({
        success: false,
        message: "Review is required (maximum 3000 characters).",
      });
    }

    const product = await Product.findById(productId).select("name slug");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const images = (req.files || []).map((file) => ({
      url: file.path,
      publicId: file.filename,
    }));

    const newReview = await Review.create({
      productId: product._id,
      productSlug: product.slug || productSlug || "",
      productName: product.name || productName || "",
      name: cleanName,
      userName: cleanName,
      rating: numericRating,
      review: cleanReview,
      comment: cleanReview,
      images,
    });

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully.",
      review: newReview,
      data: newReview,
    });
  } catch (error) {
    console.error("Create review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit review.",
    });
  }
};

/* =====================================================
   13. GET PRODUCT REVIEWS
===================================================== */

export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const exists = await Product.exists({ _id: productId });

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const requestedPage = Number(req.query.page);
    const requestedLimit = Number(req.query.limit);

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 50;

    const filter = {
      productId: new mongoose.Types.ObjectId(productId),
    };

    const [reviews, total, ratingStats] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Review.countDocuments(filter),

      Review.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$rating",
            count: { $sum: 1 },
            sum: { $sum: "$rating" },
          },
        },
      ]),
    ]);

    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;

    for (const item of ratingStats) {
      counts[item._id] = item.count;
      ratingSum += item.sum;
    }

    return res.status(200).json({
      success: true,
      reviews,
      data: reviews,
      total,
      average: total > 0 ? Number((ratingSum / total).toFixed(2)) : 0,
      counts,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get product reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews.",
    });
  }
};

/* =====================================================
   14. GET REVIEW SUMMARY
===================================================== */

export const getReviewSummary = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const summary = await Review.aggregate([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          average: { $avg: "$rating" },
          ratings: { $push: "$rating" },
        },
      },
    ]);

    const result = summary[0];
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const rating of result?.ratings || []) {
      counts[rating] += 1;
    }

    return res.status(200).json({
      success: true,
      total: result?.total || 0,
      average: result ? Number(result.average.toFixed(2)) : 0,
      counts,
    });
  } catch (error) {
    console.error("Review summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch review summary.",
    });
  }
};

/* =====================================================
   15. GET DESKTOP PRODUCTS
===================================================== */

export const getDesktopProducts = async (req, res) => {
  try {
    const cacheKey = `desktop:${JSON.stringify(req.query)}`;
    const cached = await getCachedResponse(res, cacheKey);

    if (cached.hit) {
      return res.status(200).json(cached.data);
    }

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      48,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 12)
    );

    const skip = (page - 1) * limit;

    const categorySlug = String(
      req.query.category || "desktop-offer"
    ).trim().toLowerCase();

    const filter = {};

    if (categorySlug && categorySlug !== "all") {
      const found = await applyCategoryFilter(filter, categorySlug);

      if (!found) {
        const emptyResponse = {
          success: true,
          count: 0,
          total: 0,
          page,
          limit,
          totalPages: 0,
          products: [],
          message: `Category not found: ${categorySlug}`,
        };

        return sendCachedResponse(res, cacheKey, emptyResponse);
      }
    }

    const offer = String(req.query.offer || "").toLowerCase();

    if (["true", "1", "yes"].includes(offer)) {
      const offerConditions = [
        { $gt: ["$price", 0] },
        { $gt: ["$discountPrice", 0] },
        { $lt: ["$discountPrice", "$price"] },
      ];

      filter.$expr = filter.$expr
        ? { $and: [filter.$expr, ...offerConditions] }
        : { $and: offerConditions };
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select("-__v")
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .populate("childCategory", "name slug")
        .populate("subChildCategory", "name slug")
        .populate("additionalCategories", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Product.countDocuments(filter),
    ]);

    const response = {
      success: true,
      count: products.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      products,
    };

    return sendCachedResponse(res, cacheKey, response);
  } catch (error) {
    console.error("GET DESKTOP PRODUCTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch desktop products",
    });
  }
};
