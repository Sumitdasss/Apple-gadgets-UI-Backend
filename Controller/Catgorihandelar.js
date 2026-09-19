import mongoose from "mongoose";
import Category from "../Model/Catagori.js";

// ======================================================
// CREATE CATEGORY
// ======================================================
export const createCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      parent = null,
      description = "",
      image = "",
      sortOrder = 0,
      isActive = true,
    } = req.body;

    // ------------------------------------------
    // NAME CHECK
    // ------------------------------------------
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // ------------------------------------------
    // SLUG GENERATE
    // ------------------------------------------
    const categorySlug =
      slug?.trim().toLowerCase() ||
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    // ------------------------------------------
    // PARENT CHECK
    // ------------------------------------------
    let parentCategory = null;
    let level = 0;
    let path = [];

    if (parent) {
      // Check valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(parent)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category ID",
        });
      }

      parentCategory = await Category.findById(parent);

      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found",
        });
      }

      level = parentCategory.level + 1;

      path = [
        ...parentCategory.path,
        parentCategory._id,
      ];
    }

    // ------------------------------------------
    // DUPLICATE CHECK
    // Same name/slug is allowed under
    // different parents.
    // ------------------------------------------

    const existingCategory = await Category.findOne({
      slug: categorySlug,
      parent: parent || null,
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message:
          "A category with this name/slug already exists under the same parent",
      });
    }

    // ------------------------------------------
    // CREATE CATEGORY
    // ------------------------------------------

    const category = await Category.create({
      name: name.trim(),
      slug: categorySlug,
      parent: parent || null,
      level,
      path,
      description,
      image,
      sortOrder,
      isActive,
    });

    // ------------------------------------------
    // SUCCESS
    // ------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Create category error:", error);

    // MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category already exists under this parent",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};
export const getAllChildCategories = async (req, res) => {
  try {
    const { parentId } = req.params;

    // Parent ID check
    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "Parent category ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parent category ID",
      });
    }

    // Parent category আছে কিনা check
    const parentCategory = await Category.findById(parentId);

    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    // সরাসরি এই parent-এর under-এর সব child
    const childCategories = await Category.find({
      parent: parentId,
      isActive: true,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: childCategories.length,
      parent: {
        _id: parentCategory._id,
        name: parentCategory.name,
        slug: parentCategory.slug,
      },
      categories: childCategories,
    });
  } catch (error) {
    console.error("Get all child categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get child categories",
      error: error.message,
    });
  }
};

export const createChildCategory = async (req, res) => {
  try {
    const { name, parent } = req.body;

    // ==============================
    // VALIDATION
    // ==============================

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Child category name is required",
      });
    }

    if (!parent) {
      return res.status(400).json({
        success: false,
        message: "Parent category is required",
      });
    }

    // ==============================
    // CHECK OBJECT ID
    // ==============================

    if (!mongoose.Types.ObjectId.isValid(parent)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parent category ID",
      });
    }

    // ==============================
    // FIND PARENT
    // ==============================

    const parentCategory = await Category.findById(parent);

    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    // ==============================
    // CREATE SLUG
    // ==============================

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // ==============================
    // DUPLICATE CHECK
    // SAME PARENT ONLY
    // ==============================

    const existingCategory = await Category.findOne({
      parent: parentCategory._id,
      slug: slug,
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message:
          "This category already exists under the same parent",
      });
    }

    // ==============================
    // CREATE CHILD CATEGORY
    // ==============================

    const childCategory = await Category.create({
      name: name.trim(),

      slug,

      parent: parentCategory._id,

      // Parent level + 1
      level: parentCategory.level + 1,

      // Full hierarchy path
      path: [
        ...(parentCategory.path || []),
        parentCategory._id,
      ],

      description: "",

      image: "",

      isActive: true,

      sortOrder: 0,
    });

    // ==============================
    // RESPONSE
    // ==============================

    return res.status(201).json({
      success: true,
      message: "Child category created successfully",
      category: childCategory,
    });
  } catch (error) {
    console.error(
      "Create child category error:",
      error
    );

    // ==============================
    // DUPLICATE INDEX ERROR
    // ==============================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This category already exists under the same parent",
        error: error.keyValue,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create child category",
      error: error.message,
    });
  }
};



// ======================================================
// GET ALL CATEGORIES
// ======================================================
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({
        level: 1,
        sortOrder: 1,
        name: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get categories",
      error: error.message,
    });
  }
};

// ======================================================
// GET ROOT CATEGORIES
// ======================================================
export const getRootCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      parent: null,
      isActive: true,
    })
      .sort({
        sortOrder: 1,
        name: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get root categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get root categories",
      error: error.message,
    });
  }
};

// ======================================================
// GET CHILD CATEGORIES
// ======================================================
export const getChildCategories = async (req, res) => {
  try {
    const { parentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parent category ID",
      });
    }

    const parent = await Category.findById(parentId);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    const categories = await Category.find({
      parent: parentId,
      isActive: true,
    })
      .sort({
        sortOrder: 1,
        name: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      parent,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get child categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get child categories",
      error: error.message,
    });
  }
};

// ======================================================
// GET CATEGORY TREE
// ======================================================
export const getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.find({
      isActive: true,
    })
      .sort({
        sortOrder: 1,
        name: 1,
      })
      .lean();

    // ------------------------------------------
    // CREATE MAP
    // ------------------------------------------
    const categoryMap = new Map();

    categories.forEach((category) => {
      category.children = [];
      categoryMap.set(category._id.toString(), category);
    });

    // ------------------------------------------
    // BUILD TREE
    // ------------------------------------------
    const tree = [];

    categories.forEach((category) => {
      if (category.parent) {
        const parent = categoryMap.get(
          category.parent.toString()
        );

        if (parent) {
          parent.children.push(category);
        }
      } else {
        tree.push(category);
      }
    });

    return res.status(200).json({
      success: true,
      categories: tree,
    });
  } catch (error) {
    console.error("Get category tree error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get category tree",
      error: error.message,
    });
  }
};

// ======================================================
// GET SINGLE CATEGORY
// ======================================================
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id)
      .populate("parent")
      .populate("path");

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Get category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get category",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE CATEGORY
// ======================================================
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      slug,
      description,
      image,
      sortOrder,
      isActive,
    } = req.body;

    // ------------------------------------------
    // ID CHECK
    // ------------------------------------------
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ------------------------------------------
    // UPDATE NAME
    // ------------------------------------------
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name cannot be empty",
        });
      }

      category.name = name.trim();
    }

    // ------------------------------------------
    // UPDATE SLUG
    // ------------------------------------------
    if (slug !== undefined) {
      const newSlug = slug.trim().toLowerCase();

      const duplicate = await Category.findOne({
        slug: newSlug,
        _id: { $ne: id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Another category already uses this slug",
        });
      }

      category.slug = newSlug;
    }

    // ------------------------------------------
    // OTHER FIELDS
    // ------------------------------------------
    if (description !== undefined) {
      category.description = description;
    }

    if (image !== undefined) {
      category.image = image;
    }

    if (sortOrder !== undefined) {
      category.sortOrder = Number(sortOrder);
    }

    if (isActive !== undefined) {
      category.isActive = isActive;
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Update category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

// ======================================================
// DELETE CATEGORY
// ======================================================
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // ------------------------------------------
    // ID CHECK
    // ------------------------------------------
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ------------------------------------------
    // CHECK CHILDREN
    // ------------------------------------------
    const children = await Category.countDocuments({
      parent: id,
    });

    if (children > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category because it has child categories",
      });
    }

    // ------------------------------------------
    // DELETE
    // ------------------------------------------
    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};