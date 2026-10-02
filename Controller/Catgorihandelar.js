
import mongoose from "mongoose";

import {
  MainCategory,
  SubCategory,
  ChildCategory,
  SubChildCategory,
} from "../Model/Catagori.js";

// ======================================================
// HELPER: CREATE SLUG
// ======================================================

const createSlug = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");


// ======================================================
// HELPER: VALIDATE OBJECT ID
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};


// ======================================================
// 1. MAIN CATEGORY
// ======================================================

// ======================================================
// CREATE MAIN CATEGORY
// POST /category/main
// ======================================================

export const createMainCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      description = "",
      image = "",
      sortOrder = 0,
      isActive = true,
    } = req.body;

    // -----------------------------------------------
    // Validation
    // -----------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Main category name is required",
      });
    }

    // -----------------------------------------------
    // Create slug
    // -----------------------------------------------

    const categorySlug =
      slug?.trim().toLowerCase() || createSlug(name);

    // -----------------------------------------------
    // Check duplicate
    // -----------------------------------------------

    const existing = await MainCategory.findOne({
      slug: categorySlug,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Main category with this slug already exists",
      });
    }

    // -----------------------------------------------
    // Create
    // -----------------------------------------------

    const category = await MainCategory.create({
      name: name.trim(),
      slug: categorySlug,
      description,
      image,
      sortOrder,
      isActive,

      // Initial references
      subCategories: [],
      childCategories: [],
      subChildCategories: [],

      // Initial counts
      counts: {
        subCategories: 0,
        childCategories: 0,
        subChildCategories: 0,
        total: 0,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Main category created successfully",
      category,
    });
  } catch (error) {
    console.error(
      "Create main category error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create main category",
      error: error.message,
    });
  }
};


// ======================================================
// GET ALL MAIN CATEGORIES
// ======================================================

export const getMainCategories = async (req, res) => {
  try {
    const categories = await MainCategory.find({
      isActive: true,
    })
      .sort({
        sortOrder: 1,
        name: 1,
      })
      .populate({
        path: "subCategories",
        match: {
          isActive: true,
        },
        options: {
          sort: {
            sortOrder: 1,
            name: 1,
          },
        },
        populate: {
          path: "childCategories",
          match: {
            isActive: true,
          },
          options: {
            sort: {
              sortOrder: 1,
              name: 1,
            },
          },
          populate: {
            path: "subChildCategories",
            match: {
              isActive: true,
            },
            options: {
              sort: {
                sortOrder: 1,
                name: 1,
              },
            },
          },
        },
      });

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error(
      "Get main categories error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get main categories",
      error: error.message,
    });
  }
};


// ======================================================
// GET MAIN CATEGORY BY ID
// ======================================================

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
        match: {
          isActive: true,
        },
        populate: {
          path: "childCategories",
          match: {
            isActive: true,
          },
          populate: {
            path: "subChildCategories",
            match: {
              isActive: true,
            },
          },
        },
      });

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
    console.error(
      "Get main category error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get main category",
      error: error.message,
    });
  }
};


// ======================================================
// 2. SUB CATEGORY
// ======================================================

// ======================================================
// CREATE SUB CATEGORY
// ======================================================

export const createSubCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      mainCategory,
      description = "",
      image = "",
      sortOrder = 0,
      isActive = true,
    } = req.body;

    // -----------------------------------------------
    // Validation
    // -----------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Sub category name is required",
      });
    }

    if (
      !mainCategory ||
      !isValidObjectId(mainCategory)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid mainCategory ID is required",
      });
    }

    // -----------------------------------------------
    // Find parent
    // -----------------------------------------------

    const parentMain =
      await MainCategory.findById(mainCategory);

    if (!parentMain) {
      return res.status(404).json({
        success: false,
        message: "Main category not found",
      });
    }

    // -----------------------------------------------
    // Slug
    // -----------------------------------------------

    const categorySlug =
      slug?.trim().toLowerCase() || createSlug(name);

    // -----------------------------------------------
    // Duplicate check
    // -----------------------------------------------

    const existing = await SubCategory.findOne({
      mainCategory,
      slug: categorySlug,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Sub category with this slug already exists under this Main Category",
      });
    }

    // -----------------------------------------------
    // CREATE SUB
    // -----------------------------------------------

    const category = await SubCategory.create({
      name: name.trim(),
      slug: categorySlug,
      mainCategory,
      description,
      image,
      sortOrder,
      isActive,

      childCategories: [],
      subChildCategories: [],

      counts: {
        childCategories: 0,
        subChildCategories: 0,
        total: 0,
      },
    });

    // -----------------------------------------------
    // UPDATE MAIN
    // -----------------------------------------------

    await MainCategory.findByIdAndUpdate(
      mainCategory,
      {
        $addToSet: {
          subCategories: category._id,
        },

        $inc: {
          "counts.subCategories": 1,
          "counts.total": 1,
        },
      },
      {
        new: true,
      }
    );

    return res.status(201).json({
      success: true,
      message: "Sub category created successfully",
      category,
    });
  } catch (error) {
    console.error(
      "Create sub category error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create sub category",
      error: error.message,
    });
  }
};


// ======================================================
// GET SUB CATEGORIES BY MAIN
// ======================================================

export const getSubCategoriesByMain = async (
  req,
  res
) => {
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
      .populate(
        "mainCategory",
        "name slug description image"
      )
      .populate({
        path: "childCategories",
        match: {
          isActive: true,
        },
        populate: {
          path: "subChildCategories",
          match: {
            isActive: true,
          },
        },
      })
      .sort({
        sortOrder: 1,
        name: 1,
      });

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error(
      "Get sub categories error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get sub categories",
      error: error.message,
    });
  }
};


// ======================================================
// 3. CHILD CATEGORY
// ======================================================

// ======================================================
// CREATE CHILD CATEGORY
// ======================================================

export const createChildCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      subCategory,
      description = "",
      image = "",
      sortOrder = 0,
      isActive = true,
    } = req.body;

    // -----------------------------------------------
    // Validation
    // -----------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Child category name is required",
      });
    }

    if (
      !subCategory ||
      !isValidObjectId(subCategory)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid subCategory ID is required",
      });
    }

    // -----------------------------------------------
    // Find parent Sub
    // -----------------------------------------------

    const parentSub =
      await SubCategory.findById(subCategory);

    if (!parentSub) {
      return res.status(404).json({
        success: false,
        message: "Sub category not found",
      });
    }

    // -----------------------------------------------
    // Get Main ID
    // -----------------------------------------------

    const mainCategory = parentSub.mainCategory;

    // -----------------------------------------------
    // Slug
    // -----------------------------------------------

    const categorySlug =
      slug?.trim().toLowerCase() || createSlug(name);

    // -----------------------------------------------
    // Duplicate
    // -----------------------------------------------

    const existing =
      await ChildCategory.findOne({
        subCategory,
        slug: categorySlug,
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Child category with this slug already exists under this Sub Category",
      });
    }

    // -----------------------------------------------
    // CREATE CHILD
    // -----------------------------------------------

    const category =
      await ChildCategory.create({
        name: name.trim(),
        slug: categorySlug,

        subCategory,
        mainCategory,

        description,
        image,
        sortOrder,
        isActive,

        subChildCategories: [],

        counts: {
          subChildCategories: 0,
          total: 0,
        },
      });

    // -----------------------------------------------
    // UPDATE SUB
    // -----------------------------------------------

    await SubCategory.findByIdAndUpdate(
      subCategory,
      {
        $addToSet: {
          childCategories: category._id,
        },

        $inc: {
          "counts.childCategories": 1,
          "counts.total": 1,
        },
      }
    );

    // -----------------------------------------------
    // UPDATE MAIN
    // -----------------------------------------------

    await MainCategory.findByIdAndUpdate(
      mainCategory,
      {
        $addToSet: {
          childCategories: category._id,
        },

        $inc: {
          "counts.childCategories": 1,
          "counts.total": 1,
        },
      }
    );

    return res.status(201).json({
      success: true,
      message: "Child category created successfully",
      category,
    });
  } catch (error) {
    console.error(
      "Create child category error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create child category",
      error: error.message,
    });
  }
};


// ======================================================
// GET CHILD BY SUB
// ======================================================

export const getChildCategoriesBySub = async (
  req,
  res
) => {
  try {
    const { subCategoryId } = req.params;

    if (!isValidObjectId(subCategoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sub category ID",
      });
    }

    const categories =
      await ChildCategory.find({
        subCategory: subCategoryId,
        isActive: true,
      })
        .populate(
          "subCategory",
          "name slug description image"
        )
        .populate(
          "mainCategory",
          "name slug description image"
        )
        .populate({
          path: "subChildCategories",
          match: {
            isActive: true,
          },
        })
        .sort({
          sortOrder: 1,
          name: 1,
        });

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error(
      "Get child categories error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get child categories",
      error: error.message,
    });
  }
};


// ======================================================
// 4. SUB CHILD CATEGORY
// ======================================================

// ======================================================
// CREATE SUB CHILD CATEGORY
// ======================================================

export const createSubChildCategory = async (
  req,
  res
) => {
  try {
    const {
      name,
      slug,
      childCategory,
      description = "",
      image = "",
      sortOrder = 0,
      isActive = true,
    } = req.body;

    // -----------------------------------------------
    // Validation
    // -----------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Sub Child category name is required",
      });
    }

    if (
      !childCategory ||
      !isValidObjectId(childCategory)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid childCategory ID is required",
      });
    }

    // -----------------------------------------------
    // Find parent Child
    // -----------------------------------------------

    const parentChild =
      await ChildCategory.findById(childCategory);

    if (!parentChild) {
      return res.status(404).json({
        success: false,
        message: "Child category not found",
      });
    }

    // -----------------------------------------------
    // Parent IDs
    // -----------------------------------------------

    const subCategory =
      parentChild.subCategory;

    const mainCategory =
      parentChild.mainCategory;

    // -----------------------------------------------
    // Slug
    // -----------------------------------------------

    const categorySlug =
      slug?.trim().toLowerCase() || createSlug(name);

    // -----------------------------------------------
    // Duplicate
    // -----------------------------------------------

    const existing =
      await SubChildCategory.findOne({
        childCategory,
        slug: categorySlug,
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Sub Child category with this slug already exists under this Child Category",
      });
    }

    // -----------------------------------------------
    // CREATE SUB CHILD
    // -----------------------------------------------

    const category =
      await SubChildCategory.create({
        name: name.trim(),
        slug: categorySlug,

        childCategory,
        subCategory,
        mainCategory,

        description,
        image,
        sortOrder,
        isActive,
      });

    // -----------------------------------------------
    // UPDATE CHILD
    // -----------------------------------------------

    await ChildCategory.findByIdAndUpdate(
      childCategory,
      {
        $addToSet: {
          subChildCategories: category._id,
        },

        $inc: {
          "counts.subChildCategories": 1,
          "counts.total": 1,
        },
      }
    );

    // -----------------------------------------------
    // UPDATE SUB
    // -----------------------------------------------

    await SubCategory.findByIdAndUpdate(
      subCategory,
      {
        $addToSet: {
          subChildCategories: category._id,
        },

        $inc: {
          "counts.subChildCategories": 1,
          "counts.total": 1,
        },
      }
    );

    // -----------------------------------------------
    // UPDATE MAIN
    // -----------------------------------------------

    await MainCategory.findByIdAndUpdate(
      mainCategory,
      {
        $addToSet: {
          subChildCategories: category._id,
        },

        $inc: {
          "counts.subChildCategories": 1,
          "counts.total": 1,
        },
      }
    );

    return res.status(201).json({
      success: true,
      message:
        "Sub Child category created successfully",
      category,
    });
  } catch (error) {
    console.error(
      "Create sub child category error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create sub child category",
      error: error.message,
    });
  }
};


// ======================================================
// GET SUB CHILD BY CHILD
// ======================================================

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

    const categories =
      await SubChildCategory.find({
        childCategory: childCategoryId,
        isActive: true,
      })
        .populate(
          "childCategory",
          "name slug description image"
        )
        .populate(
          "subCategory",
          "name slug description image"
        )
        .populate(
          "mainCategory",
          "name slug description image"
        )
        .sort({
          sortOrder: 1,
          name: 1,
        });

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error(
      "Get sub child categories error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get sub child categories",
      error: error.message,
    });
  }
};


// ======================================================
// 5. FULL CATEGORY TREE
// Main -> Sub -> Child -> SubChild
// ======================================================

export const getFullCategoryTree = async (
  req,
  res
) => {
  try {
    const [
      mainCategories,
      subCategories,
      childCategories,
      subChildCategories,
    ] = await Promise.all([
      MainCategory.find({
        isActive: true,
      })
        .sort({
          sortOrder: 1,
          name: 1,
        })
        .lean(),

      SubCategory.find({
        isActive: true,
      })
        .sort({
          sortOrder: 1,
          name: 1,
        })
        .lean(),

      ChildCategory.find({
        isActive: true,
      })
        .sort({
          sortOrder: 1,
          name: 1,
        })
        .lean(),

      SubChildCategory.find({
        isActive: true,
      })
        .sort({
          sortOrder: 1,
          name: 1,
        })
        .lean(),
    ]);

    // ==================================================
    // BUILD TREE
    // ==================================================

    const tree = mainCategories.map((main) => {

      // -----------------------------------------------
      // SUBS
      // -----------------------------------------------

      const subs = subCategories
        .filter(
          (sub) =>
            sub.mainCategory &&
            sub.mainCategory.toString() ===
              main._id.toString()
        )
        .map((sub) => {

          // ---------------------------------------------
          // CHILDREN
          // ---------------------------------------------

          const children = childCategories
            .filter(
              (child) =>
                child.subCategory &&
                child.subCategory.toString() ===
                  sub._id.toString()
            )
            .map((child) => {

              // -----------------------------------------
              // SUB CHILDREN
              // -----------------------------------------

              const subChildren =
                subChildCategories.filter(
                  (subChild) =>
                    subChild.childCategory &&
                    subChild.childCategory.toString() ===
                      child._id.toString()
                );

              return {
                ...child,

                subChildCategories:
                  subChildren,

                counts: {
                  subChildCategories:
                    subChildren.length,

                  total:
                    subChildren.length,
                },
              };
            });

          // All sub children under this Sub
          const allSubChildren =
            subChildCategories.filter(
              (subChild) =>
                subChild.subCategory &&
                subChild.subCategory.toString() ===
                  sub._id.toString()
            );

          return {
            ...sub,

            childCategories:
              children,

            counts: {
              childCategories:
                children.length,

              subChildCategories:
                allSubChildren.length,

              total:
                children.length +
                allSubChildren.length,
            },
          };
        });

      // -----------------------------------------------
      // MAIN DIRECT COUNTS
      // -----------------------------------------------

      const mainChildren =
        childCategories.filter(
          (child) =>
            child.mainCategory &&
            child.mainCategory.toString() ===
              main._id.toString()
        );

      const mainSubChildren =
        subChildCategories.filter(
          (subChild) =>
            subChild.mainCategory &&
            subChild.mainCategory.toString() ===
              main._id.toString()
        );

      return {
        ...main,

        subCategories: subs,

        counts: {
          subCategories: subs.length,

          childCategories:
            mainChildren.length,

          subChildCategories:
            mainSubChildren.length,

          total:
            subs.length +
            mainChildren.length +
            mainSubChildren.length,
        },
      };
    });

    return res.status(200).json({
      success: true,

      message:
        "Complete category tree fetched successfully",

      count: tree.length,

      categories: tree,
    });
  } catch (error) {
    console.error(
      "Get category tree error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch complete category tree",
      error: error.message,
    });
  }
};


// ======================================================
// 6. DELETE SUB CHILD CATEGORY
// ======================================================

export const deleteSubChildCategory = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid sub child category ID",
      });
    }

    const category =
      await SubChildCategory.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message:
          "Sub child category not found",
      });
    }

    // -----------------------------------------------
    // UPDATE CHILD
    // -----------------------------------------------

    await ChildCategory.findByIdAndUpdate(
      category.childCategory,
      {
        $pull: {
          subChildCategories: category._id,
        },

        $inc: {
          "counts.subChildCategories": -1,
          "counts.total": -1,
        },
      }
    );

    // -----------------------------------------------
    // UPDATE SUB
    // -----------------------------------------------

    await SubCategory.findByIdAndUpdate(
      category.subCategory,
      {
        $pull: {
          subChildCategories: category._id,
        },

        $inc: {
          "counts.subChildCategories": -1,
          "counts.total": -1,
        },
      }
    );

    // -----------------------------------------------
    // UPDATE MAIN
    // -----------------------------------------------

    await MainCategory.findByIdAndUpdate(
      category.mainCategory,
      {
        $pull: {
          subChildCategories: category._id,
        },

        $inc: {
          "counts.subChildCategories": -1,
          "counts.total": -1,
        },
      }
    );

    // -----------------------------------------------
    // DELETE
    // -----------------------------------------------

    await SubChildCategory.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Sub child category deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete sub child category error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete sub child category",
      error: error.message,
    });
  }
};


// ======================================================
// 7. DELETE CHILD CATEGORY
// ======================================================

export const deleteChildCategory = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid child category ID",
      });
    }

    const category =
      await ChildCategory.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message:
          "Child category not found",
      });
    }

    // -----------------------------------------------
    // SAFETY CHECK
    // -----------------------------------------------

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

    // -----------------------------------------------
    // UPDATE SUB
    // -----------------------------------------------

    await SubCategory.findByIdAndUpdate(
      category.subCategory,
      {
        $pull: {
          childCategories: category._id,
        },

        $inc: {
          "counts.childCategories": -1,
          "counts.total": -1,
        },
      }
    );

    // -----------------------------------------------
    // UPDATE MAIN
    // -----------------------------------------------

    await MainCategory.findByIdAndUpdate(
      category.mainCategory,
      {
        $pull: {
          childCategories: category._id,
        },

        $inc: {
          "counts.childCategories": -1,
          "counts.total": -1,
        },
      }
    );

    // -----------------------------------------------
    // DELETE
    // -----------------------------------------------

    await ChildCategory.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Child category deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete child category error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete child category",
      error: error.message,
    });
  }
};


// ======================================================
// 8. DELETE SUB CATEGORY
// ======================================================

export const deleteSubCategory = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid sub category ID",
      });
    }

    const category =
      await SubCategory.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message:
          "Sub category not found",
      });
    }

    // -----------------------------------------------
    // SAFETY CHECK
    // -----------------------------------------------

    const childCount =
      await ChildCategory.countDocuments({
        subCategory: id,
      });

    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete Sub Category because it contains Child Categories",
      });
    }

    // -----------------------------------------------
    // UPDATE MAIN
    // -----------------------------------------------

    await MainCategory.findByIdAndUpdate(
      category.mainCategory,
      {
        $pull: {
          subCategories: category._id,
        },

        $inc: {
          "counts.subCategories": -1,
          "counts.total": -1,
        },
      }
    );

    // -----------------------------------------------
    // DELETE
    // -----------------------------------------------

    await SubCategory.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Sub category deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete sub category error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete sub category",
      error: error.message,
    });
  }
};


// ======================================================
// 9. DELETE MAIN CATEGORY
// ======================================================

export const deleteMainCategory = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid main category ID",
      });
    }

    const category =
      await MainCategory.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message:
          "Main category not found",
      });
    }

    // -----------------------------------------------
    // SAFETY CHECK
    // -----------------------------------------------

    const subCount =
      await SubCategory.countDocuments({
        mainCategory: id,
      });

    const childCount =
      await ChildCategory.countDocuments({
        mainCategory: id,
      });

    const subChildCount =
      await SubChildCategory.countDocuments({
        mainCategory: id,
      });

    if (
      subCount > 0 ||
      childCount > 0 ||
      subChildCount > 0
    ) {
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

    return res.status(200).json({
      success: true,
      message:
        "Main category deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete main category error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete main category",
      error: error.message,
    });
  }
};


