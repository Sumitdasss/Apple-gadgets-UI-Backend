import mongoose from "mongoose";
import LandingPage from "../Model/LandingPage.js";

const validId = (id) => mongoose.isValidObjectId(id);

const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Parse JSON fields from FormData or accept objects/arrays.
const parseJSONField = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${fieldName} must contain valid JSON`);
  }
};

const getUploadedFiles = (req, fieldName) =>
  req.files?.[fieldName] || [];

const getFileUrl = (file) =>
  file?.path || file?.secure_url || file?.url || "";

// Normalize sections (updated with offers support).
const normalizeSections = (sections) => {
  if (sections === undefined) return undefined;

  if (!Array.isArray(sections)) {
    throw new Error("Sections must be an array");
  }

  return sections.map((section) => {
    if (!section || typeof section !== "object" || Array.isArray(section)) {
      throw new Error("Invalid section data");
    }

    return {
      ...(section._id && { _id: section._id }),
      type: section.type,
      title: section.title || "",
      subtitle: section.subtitle || "",
      description: section.description || "",
      image: section.image || "",
      buttonText: section.buttonText || "",
      buttonLink: section.buttonLink || "",

      // Banners
      banners: Array.isArray(section.banners)
        ? section.banners.map((banner) => ({
            ...(banner?._id && { _id: banner._id }),
            image: banner?.image || "",
            link: banner?.link || "",
            alt: banner?.alt || "",
          }))
        : [],

      // Product IDs
      productIds: Array.isArray(section.productIds)
        ? section.productIds.map((product) => {
            const productId =
              typeof product === "string" ? product : product?._id;

            if (!validId(productId)) {
              throw new Error(
                `Invalid product ID: ${productId || "missing"}`
              );
            }

            return productId;
          })
        : [],

      // Features
      features: Array.isArray(section.features)
        ? section.features.map((feature) => {
            if (typeof feature === "string") {
              return {
                title: feature,
                description: "",
                icon: "",
              };
            }

            return {
              title: feature?.title || "",
              description: feature?.description || "",
              icon: feature?.icon || "",
            };
          })
        : [],

      // Offers (Latest Offers section)
      offers: Array.isArray(section.offers)
        ? section.offers.map((offer) => ({
            ...(offer?._id && { _id: offer._id }),
            title: offer?.title || "",
            image: offer?.image || "",
            link: offer?.link || "",
            alt: offer?.alt || "",
            endDate: offer?.endDate ? new Date(offer.endDate) : undefined,
            buttonText: offer?.buttonText || "View Details",
          }))
        : [],
    };
  });
};

// Normalize SEO.
const normalizeSeo = (seo) => {
  if (seo === undefined) return undefined;

  if (!seo || typeof seo !== "object" || Array.isArray(seo)) {
    throw new Error("SEO must be an object");
  }

  return {
    metaTitle: seo.metaTitle || "",
    metaDescription: seo.metaDescription || "",
    ogImage: seo.ogImage || "",
  };
};

// Apply uploaded section, banner and offer images.
const applyUploadedImages = (sections, req) => {
  if (!Array.isArray(sections)) return sections;

  const sectionFiles = getUploadedFiles(req, "sectionImages");
  const bannerFiles = getUploadedFiles(req, "bannerImages");
  const offerFiles = getUploadedFiles(req, "offerImages");

  // ---------- Section Images ----------
  const rawSectionIndexes = parseJSONField(
    req.body.sectionImageIndexes,
    "sectionImageIndexes"
  );

  const sectionImageIndexes = Array.isArray(rawSectionIndexes)
    ? rawSectionIndexes
    : [];

  sectionFiles.forEach((file, fileIndex) => {
    const url = getFileUrl(file);

    if (!url) {
      throw new Error("Uploaded section image URL is missing");
    }

    const sectionIndex = Number(
      sectionImageIndexes[fileIndex] ?? fileIndex
    );

    if (!Number.isInteger(sectionIndex) || !sections[sectionIndex]) {
      throw new Error(`Invalid section image index: ${sectionIndex}`);
    }

    sections[sectionIndex].image = url;
  });

  // ---------- Banner Images ----------
  const rawBannerIndexes = parseJSONField(
    req.body.bannerFileIndexes,
    "bannerFileIndexes"
  );

  const bannerFileIndexes = Array.isArray(rawBannerIndexes)
    ? rawBannerIndexes
    : [];

  const bannerSection = sections.find(
    (section) => section.type === "banner"
  );

  if (bannerFiles.length > 0 && !bannerSection) {
    throw new Error("Banner section is missing");
  }

  bannerFiles.forEach((file, fileIndex) => {
    const url = getFileUrl(file);

    if (!url) {
      throw new Error("Uploaded banner image URL is missing");
    }

    const bannerIndex = Number(
      bannerFileIndexes[fileIndex] ?? fileIndex
    );

    if (
      !Number.isInteger(bannerIndex) ||
      !bannerSection?.banners?.[bannerIndex]
    ) {
      throw new Error(`Invalid banner image index: ${bannerIndex}`);
    }

    bannerSection.banners[bannerIndex].image = url;
  });

  // ---------- Offer Images ----------
  const rawOfferIndexes = parseJSONField(
    req.body.offerFileIndexes,
    "offerFileIndexes"
  );

  const offerFileIndexes = Array.isArray(rawOfferIndexes)
    ? rawOfferIndexes
    : [];

  // Find the offers section
  const offersSection = sections.find(
    (section) => section.type === "offers"
  );

  if (offerFiles.length > 0 && !offersSection) {
    throw new Error("Offers section is missing");
  }

  offerFiles.forEach((file, fileIndex) => {
    const url = getFileUrl(file);

    if (!url) {
      throw new Error("Uploaded offer image URL is missing");
    }

    const offerIndex = Number(
      offerFileIndexes[fileIndex] ?? fileIndex
    );

    if (
      !Number.isInteger(offerIndex) ||
      !offersSection?.offers?.[offerIndex]
    ) {
      throw new Error(`Invalid offer image index: ${offerIndex}`);
    }

    offersSection.offers[offerIndex].image = url;
  });

  return sections;
};

// Central error handler.
const handleControllerError = (res, error, fallbackMessage) => {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "This slug already exists",
    });
  }

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  const clientErrorMessages = [
    "Sections must be an array",
    "Invalid section data",
    "SEO must be an object",
    "sections must contain valid JSON",
    "seo must contain valid JSON",
    "sectionImageIndexes must contain valid JSON",
    "bannerFileIndexes must contain valid JSON",
    "offerFileIndexes must contain valid JSON",
    "Uploaded section image URL is missing",
    "Uploaded banner image URL is missing",
    "Uploaded offer image URL is missing",
    "Banner section is missing",
    "Offers section is missing",
  ];

  const isClientError =
    clientErrorMessages.includes(error.message) ||
    error.message?.startsWith("Invalid product ID:") ||
    error.message?.startsWith("Invalid section image index:") ||
    error.message?.startsWith("Invalid banner image index:") ||
    error.message?.startsWith("Invalid offer image index:");

  if (isClientError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error(fallbackMessage, error);

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

// ADMIN: Create landing page.
export const createLandingPage = async (req, res) => {
  try {
    const { title, slug, description, status } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const finalSlug = slugify(slug || title);

    if (!finalSlug) {
      return res.status(400).json({
        success: false,
        message: "A valid slug is required",
      });
    }

    if (
      status !== undefined &&
      !["draft", "published", "archived"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    let sections = parseJSONField(req.body.sections, "sections");
    const seo = parseJSONField(req.body.seo, "seo");

    sections = normalizeSections(sections);
    sections = applyUploadedImages(sections, req);

    const normalizedSeo = normalizeSeo(seo);

    const page = await LandingPage.create({
      title: title.trim(),
      slug: finalSlug,
      description: description || "",
      ...(sections !== undefined && { sections }),
      ...(normalizedSeo !== undefined && { seo: normalizedSeo }),
      ...(status !== undefined && { status }),
      ...(req.user?._id && { createdBy: req.user._id }),
    });

    return res.status(201).json({
      success: true,
      message: "Landing page created successfully",
      data: page,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to create landing page"
    );
  }
};

// ADMIN: Get all landing pages without heavy section data.
export const getLandingPages = async (req, res) => {
  try {
    const pages = await LandingPage.find()
      .sort({ updatedAt: -1 })
      .select("-sections")
      .lean();

    return res.status(200).json({
      success: true,
      count: pages.length,
      data: pages,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to fetch landing pages"
    );
  }
};

// ADMIN: Get one landing page by ID.
export const getLandingPageById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID",
      });
    }

    const page = await LandingPage.findById(id);

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: page,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to fetch landing page"
    );
  }
};

// ADMIN: Update landing page.
export const updateLandingPage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID",
      });
    }

    const existingPage = await LandingPage.findById(id);

    if (!existingPage) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    const body = req.body;
    const updates = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty",
        });
      }

      updates.title = body.title.trim();
    }

    if (body.slug !== undefined) {
      const finalSlug = slugify(body.slug);

      if (!finalSlug) {
        return res.status(400).json({
          success: false,
          message: "A valid slug is required",
        });
      }

      updates.slug = finalSlug;
    }

    if (body.description !== undefined) {
      updates.description = body.description || "";
    }

    if (body.status !== undefined) {
      if (!["draft", "published", "archived"].includes(body.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      updates.status = body.status;
    }

    if (body.sections !== undefined) {
      let sections = parseJSONField(body.sections, "sections");
      sections = normalizeSections(sections);

      if (Array.isArray(sections)) {
        sections = sections.map((section, index) => {
          const oldSection = existingPage.sections?.[index];

          // Keep old section image if new one is not provided
          if (!section.image && oldSection?.image) {
            section.image = oldSection.image;
          }

          // Keep old banner images
          if (
            section.type === "banner" &&
            oldSection?.type === "banner"
          ) {
            section.banners = section.banners.map(
              (banner, bannerIndex) => ({
                ...banner,
                image:
                  banner.image ||
                  oldSection.banners?.[bannerIndex]?.image ||
                  "",
              })
            );
          }

          // Keep old offer images
          if (
            section.type === "offers" &&
            oldSection?.type === "offers"
          ) {
            section.offers = section.offers.map(
              (offer, offerIndex) => ({
                ...offer,
                image:
                  offer.image ||
                  oldSection.offers?.[offerIndex]?.image ||
                  "",
              })
            );
          }

          return section;
        });
      }

      updates.sections = applyUploadedImages(sections, req);
    } else if (
      getUploadedFiles(req, "sectionImages").length ||
      getUploadedFiles(req, "bannerImages").length ||
      getUploadedFiles(req, "offerImages").length
    ) {
      return res.status(400).json({
        success: false,
        message: "Sections are required when uploading images",
      });
    }

    if (body.seo !== undefined) {
      updates.seo = normalizeSeo(parseJSONField(body.seo, "seo"));
    }

    const page = await LandingPage.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Landing page updated successfully",
      data: page,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to update landing page"
    );
  }
};

// ADMIN: Delete landing page.
export const deleteLandingPage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID",
      });
    }

    const page = await LandingPage.findByIdAndDelete(id);

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Landing page deleted successfully",
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to delete landing page"
    );
  }
};

// ADMIN: Publish, unpublish or archive.
export const setLandingPageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID",
      });
    }

    if (!["draft", "published", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const page = await LandingPage.findByIdAndUpdate(
      id,
      { $set: { status } },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Landing page status changed to ${status}`,
      data: page,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to update landing page status"
    );
  }
};

// PUBLIC: Get published landing page by slug.
export const getPublishedLandingPage = async (req, res) => {
  try {
    const slug = slugify(req.params.slug);

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Invalid landing page slug",
      });
    }

    const page = await LandingPage.findOne({
      slug,
      status: "published",
    }).populate({
      path: "sections.productIds",
      select: "name slug price discountPrice images stock",
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Published landing page not found",
      });
    }

    res.set("Cache-Control", "public, max-age=60");

    return res.status(200).json({
      success: true,
      data: page,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to load landing page"
    );
  }
};

// PUBLIC: Get banners from every published landing page.
export const getPublishedLandingPageBanners = async (req, res) => {
  try {
    const pages = await LandingPage.find({
      status: "published",
    })
      .select("title slug sections")
      .lean();

    const banners = pages.flatMap((page) =>
      (page.sections || [])
        .filter((section) => section.type === "banner")
        .flatMap((section) =>
          (section.banners || [])
            .filter((banner) => banner.image)
            .map((banner) => ({
              _id: banner._id,
              image: banner.image,
              link: banner.link || "",
              alt: banner.alt || section.title || page.title || "",
              pageTitle: page.title,
              pageSlug: page.slug,
            }))
        )
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    console.error("Get published banners error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch published banners",
    });
  }
};

export const getPublishedOffers = async (req, res) => {
  try {
    const pages = await LandingPage.find({
      status: "published",
      "sections.type": "offers",
    }).lean();

    const sections = pages.flatMap((page) =>
      (page.sections || [])
        .filter((section) => section.type === "offers")
        .map((section) => ({
          ...section,
          pageSlug: page.slug,
          pageTitle: page.title,
        }))
    );

    const offers = sections.flatMap((section) =>
      (section.offers || []).map((offer) => ({
        ...offer,
        pageSlug: section.pageSlug,
        pageTitle: section.pageTitle,
        sectionTitle: section.title,
      }))
    );

    return res.status(200).json({
      success: true,
      count: offers.length,
      data: offers,
    });
  } catch (error) {
    console.error("getPublishedOffers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch offers",
    });
  }
};