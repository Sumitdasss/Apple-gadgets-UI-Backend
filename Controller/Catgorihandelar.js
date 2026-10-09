import mongoose from "mongoose";

import {
  MainCategory,
  SubCategory,
  ChildCategory,
  SubChildCategory,
} from "../Model/Catagori.js";

/* ======================================================
   1. COMMON HELPERS
====================================================== */

const createSlug = (text = "") =>
  String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id) &&
  new mongoose.Types.ObjectId(id).toString() === String(id);

const idOf = (id) => (id ? id.toString() : "");

const categorySort = { sortOrder: 1, name: 1 };

const categoryFields =
  "_id name slug description image bannerImage bannerPublicId sortOrder isActive counts mainCategory subCategory childCategory subCategories childCategories subChildCategories";

const sendError = (res, message, error) => {
  console.error(message, error);

  return res.status(500).json({
    success: false,
    message,
    error: error.message,
  });
};

const getNameAndSlug = (name, slug) => {
  const cleanName = String(name || "").trim();

  return {
    name: cleanName,
    slug:
      String(slug || "").trim().toLowerCase() ||
      createSlug(cleanName),
  };
};

const validName = (name) =>
  typeof name === "string" && name.trim().length > 0;

const safeSortOrder = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeIsActive = (value) => {
  if (value === undefined) return true;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return true;
};

const checkDuplicateSlug = async (Model, filter) =>
  Model.findOne(filter).select("_id").lean();

/* ======================================================
   2. IMAGE UPLOAD HELPERS

   Supports:
   - upload.single("image")
   - upload.fields([{ name: "image" }, { name: "bannerImage" }])
   - Existing image URL in req.body
====================================================== */

const getUploadedFile = (req, fieldName) => {
  if (req.file?.fieldname === fieldName) {
    return req.file;
  }

  const files = req.files;

  if (Array.isArray(files)) {
    return (
      files.find((file) => file?.fieldname === fieldName) ||
      null
    );
  }

  if (files && Array.isArray(files[fieldName])) {
    return files[fieldName][0] || null;
  }

  return null;
};

const getUploadedImageUrl = (req, fieldName) => {
  const file = getUploadedFile(req, fieldName);

  if (file) {
    return (
      file.path ||
      file.secure_url ||
      file.url ||
      ""
    );
  }

  const bodyValue = req.body?.[fieldName];

  return typeof bodyValue === "string"
    ? bodyValue.trim()
    : "";
};

const getUploadedPublicId = (req, fieldName) => {
  const file = getUploadedFile(req, fieldName);

  if (file) {
    return (
      file.filename ||
      file.public_id ||
      file.publicId ||
      ""
    );
  }

  const value = req.body?.[`${fieldName}PublicId`];

  return typeof value === "string"
    ? value.trim()
    : "";
};

/* ======================================================
   3. CATEGORY CACHE
====================================================== */

const categoryCache = new Map();
const CATEGORY_CACHE_TTL = 30_000;
const MAX_CATEGORY_CACHE_ITEMS = 200;

export const clearCategoryCache = () => {
  categoryCache.clear();
};

export const categoryCacheMiddleware = (req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  const key = req.originalUrl;
  const cached = categoryCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return res.status(cached.status).json(cached.data);
  }

  if (cached) {
    categoryCache.delete(key);
  }

  const originalJson = res.json.bind(res);

  res.json = (data) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (categoryCache.size >= MAX_CATEGORY_CACHE_ITEMS) {
        const oldestKey = categoryCache.keys().next().value;

        if (oldestKey) {
          categoryCache.delete(oldestKey);
        }
      }

      categoryCache.set(key, {
        data,
        status: res.statusCode,
        expiresAt: Date.now() + CATEGORY_CACHE_TTL,
      });
    }

    return originalJson(data);
  };

  next();
};

/* ======================================================
   4. CREATE MAIN CATEGORY
   POST /category/main
====================================================== */

export const createMainCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      description = "",
      sortOrder = 0,
      isActive = true,
    } = req.body;

    const image = getUploadedImageUrl(req, "image");
    const bannerImage = getUploadedImageUrl(
      req,
      "bannerImage"
    );
    const bannerPublicId = getUploadedPublicId(
      req,
      "bannerImage"
    );

    if (!validName(name)) {
      return res.status(400).json({
        success: false,
        message: "Main category name is required",
      });
    }

    const values = getNameAndSlug(name, slug);

    if (!values.slug) {
      return res.status(400).json({
        success: false,
        message: "A valid category slug is required",
      });
    }

    const existing = await checkDuplicateSlug(
      MainCategory,
      { slug: values.slug }
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Main category with this slug already exists",
      });
    }

    const category = await MainCategory.create({
      ...values,
      description,
      image,
      bannerImage,
      bannerPublicId,
      sortOrder: safeSortOrder(sortOrder),
      isActive: safeIsActive(isActive),
      subCategories: [],
      childCategories: [],
      subChildCategories: [],
      counts: {
        subCategories: 0,
        childCategories: 0,
        subChildCategories: 0,
        total: 0,
      },
    });

    clearCategoryCache();

    return res.status(201).json({
      success: true,
      message: "Main category created successfully",
      category,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to create main category",
      error
    );
  }
};

/* ======================================================
   5. GET MAIN CATEGORIES
   GET /category/main
====================================================== */

export const getMainCategories = async (req, res) => {
  try {
    const categories = await MainCategory.find({
      isActive: true,
    })
      .select(categoryFields)
      .sort(categorySort)
      .populate({
        path: "subCategories",
        match: { isActive: true },
        options: { sort: categorySort },
        populate: {
          path: "childCategories",
          match: { isActive: true },
          options: { sort: categorySort },
          populate: {
            path: "subChildCategories",
            match: { isActive: true },
            options: { sort: categorySort },
          },
        },
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to get main categories",
      error
    );
  }
};

/* ======================================================
   6. GET MAIN CATEGORY BY ID
   GET /category/main/:id
====================================================== */

export const getMainCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid main category ID",
      });
    }

    const category = await MainCategory.findById(id)
      .populate({
        path: "subCategories",
        match: { isActive: true },
        options: { sort: categorySort },
        populate: {
          path: "childCategories",
          match: { isActive: true },
          options: { sort: categorySort },
          populate: {
            path: "subChildCategories",
            match: { isActive: true },
            options: { sort: categorySort },
          },
        },
      })
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Main category not found",
      });
    }

    return res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to get main category",
      error
    );
  }
};

/* ======================================================
   7. CREATE SUB CATEGORY
   POST /category/sub
====================================================== */

export const createSubCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      mainCategory,
      description = "",
      sortOrder = 0,
      isActive = true,
    } = req.body;

    const image = getUploadedImageUrl(req, "image");
    const bannerImage = getUploadedImageUrl(
      req,
      "bannerImage"
    );
    const bannerPublicId = getUploadedPublicId(
      req,
      "bannerImage"
    );

    if (!validName(name)) {
      return res.status(400).json({
        success: false,
        message: "Sub category name is required",
      });
    }

    if (!isValidObjectId(mainCategory)) {
      return res.status(400).json({
        success: false,
        message: "Valid mainCategory ID is required",
      });
    }

    const parent = await MainCategory.findById(mainCategory)
      .select("_id")
      .lean();

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Main category not found",
      });
    }

    const values = getNameAndSlug(name, slug);

    const existing = await checkDuplicateSlug(
      SubCategory,
      {
        mainCategory,
        slug: values.slug,
      }
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Sub category with this slug already exists under this Main Category",
      });
    }

    const category = await SubCategory.create({
      ...values,
      mainCategory,
      description,
      image,
      bannerImage,
      bannerPublicId,
      sortOrder: safeSortOrder(sortOrder),
      isActive: safeIsActive(isActive),
      childCategories: [],
      subChildCategories: [],
      counts: {
        childCategories: 0,
        subChildCategories: 0,
        total: 0,
      },
    });

    await MainCategory.findByIdAndUpdate(mainCategory, {
      $addToSet: {
        subCategories: category._id,
      },
      $inc: {
        "counts.subCategories": 1,
        "counts.total": 1,
      },
    });

    clearCategoryCache();

    return res.status(201).json({
      success: true,
      message: "Sub category created successfully",
      category,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to create sub category",
      error
    );
  }
};

/* ======================================================
   8. GET SUB CATEGORIES BY MAIN CATEGORY
   GET /category/sub/:mainCategoryId
====================================================== */

export const getSubCategoriesByMain = async (req, res) => {
  try {
    const { mainCategoryId } = req.params;

    if (!isValidObjectId(mainCategoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid main category ID",
      });
    }

    const categories = await SubCategory.find({
      mainCategory: mainCategoryId,
      isActive: true,
    })
      .select(categoryFields)
      .sort(categorySort)
      .populate(
        "mainCategory",
        "name slug description image bannerImage bannerPublicId"
      )
      .populate({
        path: "childCategories",
        match: { isActive: true },
        options: { sort: categorySort },
        populate: {
          path: "subChildCategories",
          match: { isActive: true },
          options: { sort: categorySort },
        },
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to get sub categories",
      error
    );
  }
};

/* ======================================================
   9. CREATE CHILD CATEGORY
   POST /category/child
====================================================== */

export const createChildCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      subCategory,
      description = "",
      sortOrder = 0,
      isActive = true,
    } = req.body;

    const image = getUploadedImageUrl(req, "image");
    const bannerImage = getUploadedImageUrl(
      req,
      "bannerImage"
    );
    const bannerPublicId = getUploadedPublicId(
      req,
      "bannerImage"
    );

    if (!validName(name)) {
      return res.status(400).json({
        success: false,
        message: "Child category name is required",
      });
    }

    if (!isValidObjectId(subCategory)) {
      return res.status(400).json({
        success: false,
        message: "Valid subCategory ID is required",
      });
    }

    const parent = await SubCategory.findById(subCategory)
      .select("_id mainCategory")
      .lean();

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Sub category not found",
      });
    }

    const mainCategory = parent.mainCategory;
    const values = getNameAndSlug(name, slug);

    const existing = await checkDuplicateSlug(
      ChildCategory,
      {
        subCategory,
        slug: values.slug,
      }
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Child category with this slug already exists under this Sub Category",
      });
    }

    const category = await ChildCategory.create({
      ...values,
      subCategory,
      mainCategory,
      description,
      image,
      bannerImage,
      bannerPublicId,
      sortOrder: safeSortOrder(sortOrder),
      isActive: safeIsActive(isActive),
      subChildCategories: [],
      counts: {
        subChildCategories: 0,
        total: 0,
      },
    });

    await Promise.all([
      SubCategory.findByIdAndUpdate(subCategory, {
        $addToSet: {
          childCategories: category._id,
        },
        $inc: {
          "counts.childCategories": 1,
          "counts.total": 1,
        },
      }),

      MainCategory.findByIdAndUpdate(mainCategory, {
        $addToSet: {
          childCategories: category._id,
        },
        $inc: {
          "counts.childCategories": 1,
          "counts.total": 1,
        },
      }),
    ]);

    clearCategoryCache();

    return res.status(201).json({
      success: true,
      message: "Child category created successfully",
      category,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to create child category",
      error
    );
  }
};

/* ======================================================
   10. GET CHILD CATEGORIES BY SUB CATEGORY
   GET /category/child/:subCategoryId
====================================================== */

export const getChildCategoriesBySub = async (req, res) => {
  try {
    const { subCategoryId } = req.params;

    if (!isValidObjectId(subCategoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sub category ID",
      });
    }

    const categories = await ChildCategory.find({
      subCategory: subCategoryId,
      isActive: true,
    })
      .select(categoryFields)
      .sort(categorySort)
      .populate(
        "subCategory",
        "name slug description image bannerImage bannerPublicId"
      )
      .populate(
        "mainCategory",
        "name slug description image bannerImage bannerPublicId"
      )
      .populate({
        path: "subChildCategories",
        match: { isActive: true },
        options: { sort: categorySort },
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to get child categories",
      error
    );
  }
};

/* ======================================================
   11. CREATE SUB CHILD CATEGORY
   POST /category/sub-child
====================================================== */

export const createSubChildCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      childCategory,
      description = "",
      sortOrder = 0,
      isActive = true,
    } = req.body;

    const image = getUploadedImageUrl(req, "image");
    const bannerImage = getUploadedImageUrl(
      req,
      "bannerImage"
    );
    const bannerPublicId = getUploadedPublicId(
      req,
      "bannerImage"
    );

    if (!validName(name)) {
      return res.status(400).json({
        success: false,
        message: "Sub Child category name is required",
      });
    }

    if (!isValidObjectId(childCategory)) {
      return res.status(400).json({
        success: false,
        message: "Valid childCategory ID is required",
      });
    }

    const parent = await ChildCategory.findById(childCategory)
      .select("_id subCategory mainCategory")
      .lean();

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Child category not found",
      });
    }

    const subCategory = parent.subCategory;
    const mainCategory = parent.mainCategory;
    const values = getNameAndSlug(name, slug);

    const existing = await checkDuplicateSlug(
      SubChildCategory,
      {
        childCategory,
        slug: values.slug,
      }
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Sub Child category with this slug already exists under this Child Category",
      });
    }

    const category = await SubChildCategory.create({
      ...values,
      childCategory,
      subCategory,
      mainCategory,
      description,
      image,
      bannerImage,
      bannerPublicId,
      sortOrder: safeSortOrder(sortOrder),
      isActive: safeIsActive(isActive),
    });

    await Promise.all([
      ChildCategory.findByIdAndUpdate(childCategory, {
        $addToSet: {
          subChildCategories: category._id,
        },
        $inc: {
          "counts.subChildCategories": 1,
          "counts.total": 1,
        },
      }),

      SubCategory.findByIdAndUpdate(subCategory, {
        $addToSet: {
          subChildCategories: category._id,
        },
        $inc: {
          "counts.subChildCategories": 1,
          "counts.total": 1,
        },
      }),

      MainCategory.findByIdAndUpdate(mainCategory, {
        $addToSet: {
          subChildCategories: category._id,
        },
        $inc: {
          "counts.subChildCategories": 1,
          "counts.total": 1,
        },
      }),
    ]);

    clearCategoryCache();

    return res.status(201).json({
      success: true,
      message: "Sub Child category created successfully",
      category,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to create sub child category",
      error
    );
  }
};

/* ======================================================
   12. GET SUB CHILD CATEGORIES BY CHILD CATEGORY
   GET /category/sub-child/:childCategoryId
====================================================== */

export const getSubChildCategoriesByChild = async (
  req,
  res
) => {
  try {
    const { childCategoryId } = req.params;

    if (!isValidObjectId(childCategoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid child category ID",
      });
    }

    const categories = await SubChildCategory.find({
      childCategory: childCategoryId,
      isActive: true,
    })
      .select(categoryFields)
      .sort(categorySort)
      .populate(
        "childCategory",
        "name slug description image bannerImage bannerPublicId"
      )
      .populate(
        "subCategory",
        "name slug description image bannerImage bannerPublicId"
      )
      .populate(
        "mainCategory",
        "name slug description image bannerImage bannerPublicId"
      )
      .lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to get sub child categories",
      error
    );
  }
};

/* ======================================================
   13. FULL CATEGORY TREE
   Main -> Sub -> Child -> SubChild
====================================================== */

export const getFullCategoryTree = async (req, res) => {
  try {
    const [
      mainCategories,
      subCategories,
      childCategories,
      subChildCategories,
    ] = await Promise.all([
      MainCategory.find({ isActive: true })
        .select(categoryFields)
        .sort(categorySort)
        .lean(),

      SubCategory.find({ isActive: true })
        .select(categoryFields)
        .sort(categorySort)
        .lean(),

      ChildCategory.find({ isActive: true })
        .select(categoryFields)
        .sort(categorySort)
        .lean(),

      SubChildCategory.find({ isActive: true })
        .select(categoryFields)
        .sort(categorySort)
        .lean(),
    ]);

    const subsByMain = new Map();
    const childrenBySub = new Map();
    const subChildrenByChild = new Map();
    const subChildrenBySub = new Map();
    const childrenByMain = new Map();
    const subChildrenByMain = new Map();

    const addToGroup = (map, parentId, item) => {
      const key = idOf(parentId);

      if (!key) return;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(item);
    };

    for (const sub of subCategories) {
      addToGroup(subsByMain, sub.mainCategory, sub);
    }

    for (const child of childCategories) {
      addToGroup(childrenBySub, child.subCategory, child);
      addToGroup(childrenByMain, child.mainCategory, child);
    }

    for (const subChild of subChildCategories) {
      addToGroup(
        subChildrenByChild,
        subChild.childCategory,
        subChild
      );

      addToGroup(
        subChildrenBySub,
        subChild.subCategory,
        subChild
      );

      addToGroup(
        subChildrenByMain,
        subChild.mainCategory,
        subChild
      );
    }

    const tree = mainCategories.map((main) => {
      const subs = (
        subsByMain.get(idOf(main._id)) || []
      ).map((sub) => {
        const children = (
          childrenBySub.get(idOf(sub._id)) || []
        ).map((child) => {
          const subChildren =
            subChildrenByChild.get(idOf(child._id)) || [];

          return {
            ...child,
            subChildCategories: subChildren,
            counts: {
              ...(child.counts || {}),
              subChildCategories: subChildren.length,
              total: subChildren.length,
            },
          };
        });

        const allSubChildren =
          subChildrenBySub.get(idOf(sub._id)) || [];

        return {
          ...sub,
          childCategories: children,
          counts: {
            ...(sub.counts || {}),
            childCategories: children.length,
            subChildCategories: allSubChildren.length,
            total: children.length + allSubChildren.length,
          },
        };
      });

      const mainChildren =
        childrenByMain.get(idOf(main._id)) || [];

      const mainSubChildren =
        subChildrenByMain.get(idOf(main._id)) || [];

      return {
        ...main,
        subCategories: subs,
        counts: {
          ...(main.counts || {}),
          subCategories: subs.length,
          childCategories: mainChildren.length,
          subChildCategories: mainSubChildren.length,
          total:
            subs.length +
            mainChildren.length +
            mainSubChildren.length,
        },
      };
    });

    return res.status(200).json({
      success: true,
      message: "Complete category tree fetched successfully",
      count: tree.length,
      categories: tree,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to fetch complete category tree",
      error
    );
  }
};

/* ======================================================
   14. DELETE SUB CHILD CATEGORY
   DELETE /category/sub-child/:id
====================================================== */

export const deleteSubChildCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sub child category ID",
      });
    }

    const category = await SubChildCategory.findById(id).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Sub child category not found",
      });
    }

    await Promise.all([
      ChildCategory.findByIdAndUpdate(
        category.childCategory,
        {
          $pull: { subChildCategories: category._id },
          $inc: {
            "counts.subChildCategories": -1,
            "counts.total": -1,
          },
        }
      ),

      SubCategory.findByIdAndUpdate(
        category.subCategory,
        {
          $pull: { subChildCategories: category._id },
          $inc: {
            "counts.subChildCategories": -1,
            "counts.total": -1,
          },
        }
      ),

      MainCategory.findByIdAndUpdate(
        category.mainCategory,
        {
          $pull: { subChildCategories: category._id },
          $inc: {
            "counts.subChildCategories": -1,
            "counts.total": -1,
          },
        }
      ),

      SubChildCategory.findByIdAndDelete(id),
    ]);

    clearCategoryCache();

    return res.status(200).json({
      success: true,
      message: "Sub child category deleted successfully",
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to delete sub child category",
      error
    );
  }
};

/* ======================================================
   15. DELETE CHILD CATEGORY
   DELETE /category/child/:id
====================================================== */

export const deleteChildCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid child category ID",
      });
    }

    const category = await ChildCategory.findById(id).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Child category not found",
      });
    }

    const subChildCount =
      await SubChildCategory.countDocuments({
        childCategory: id,
      });

    if (subChildCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete Child Category because it contains Sub Child Categories",
      });
    }

    await Promise.all([
      SubCategory.findByIdAndUpdate(
        category.subCategory,
        {
          $pull: { childCategories: category._id },
          $inc: {
            "counts.childCategories": -1,
            "counts.total": -1,
          },
        }
      ),

      MainCategory.findByIdAndUpdate(
        category.mainCategory,
        {
          $pull: { childCategories: category._id },
          $inc: {
            "counts.childCategories": -1,
            "counts.total": -1,
          },
        }
      ),

      ChildCategory.findByIdAndDelete(id),
    ]);

    clearCategoryCache();

    return res.status(200).json({
      success: true,
      message: "Child category deleted successfully",
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to delete child category",
      error
    );
  }
};

/* ======================================================
   16. DELETE SUB CATEGORY
   DELETE /category/sub/:id
====================================================== */

export const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sub category ID",
      });
    }

    const category = await SubCategory.findById(id).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Sub category not found",
      });
    }

    const childCount = await ChildCategory.countDocuments({
      subCategory: id,
    });

    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete Sub Category because it contains Child Categories",
      });
    }

    await Promise.all([
      MainCategory.findByIdAndUpdate(
        category.mainCategory,
        {
          $pull: { subCategories: category._id },
          $inc: {
            "counts.subCategories": -1,
            "counts.total": -1,
          },
        }
      ),

      SubCategory.findByIdAndDelete(id),
    ]);

    clearCategoryCache();

    return res.status(200).json({
      success: true,
      message: "Sub category deleted successfully",
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to delete sub category",
      error
    );
  }
};

/* ======================================================
   17. DELETE MAIN CATEGORY
   DELETE /category/main/:id
====================================================== */

export const deleteMainCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid main category ID",
      });
    }

    const category = await MainCategory.findById(id).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Main category not found",
      });
    }

    const [subCount, childCount, subChildCount] =
      await Promise.all([
        SubCategory.countDocuments({ mainCategory: id }),
        ChildCategory.countDocuments({ mainCategory: id }),
        SubChildCategory.countDocuments({ mainCategory: id }),
      ]);

    if (subCount > 0 || childCount > 0 || subChildCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete Main Category because it contains child categories",
        counts: {
          subCategories: subCount,
          childCategories: childCount,
          subChildCategories: subChildCount,
        },
      });
    }

    await MainCategory.findByIdAndDelete(id);

    clearCategoryCache();

    return res.status(200).json({
      success: true,
      message: "Main category deleted successfully",
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to delete main category",
      error
    );
  }
};

/* ======================================================
   18. UPDATE CATEGORY BANNER
   PATCH /category/:type/:id/banner
====================================================== */

export const updateCategoryBanner = async (req, res) => {
  try {
    const { type, id } = req.params;

    const bannerImage = getUploadedImageUrl(
      req,
      "bannerImage"
    );

    const bannerPublicId = getUploadedPublicId(
      req,
      "bannerImage"
    );

    const models = {
      main: MainCategory,
      sub: SubCategory,
      child: ChildCategory,
      "sub-child": SubChildCategory,
    };

    const Category = models[type];

    if (!Category) {
      return res.status(400).json({
        success: false,
        message: "Invalid category type",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    if (
      typeof bannerImage !== "string" ||
      !/^https?:\/\/\S+$/i.test(bannerImage)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid bannerImage URL is required",
      });
    }

    if (
      typeof bannerPublicId !== "string" ||
      bannerPublicId.length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid bannerPublicId",
      });
    }

    const category = await Category.findByIdAndUpdate(
      id,
      {
        $set: {
          bannerImage,
          bannerPublicId,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    clearCategoryCache();

    return res.status(200).json({
      success: true,
      message: "Category banner updated successfully",
      category,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to update category banner",
      error
    );
  }
};