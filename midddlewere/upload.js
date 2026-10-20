
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudnary.js";

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

const storage = new CloudinaryStorage({
  cloudinary,

  params: async (req, file) => {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error("Only JPG, PNG and WEBP images are allowed.");
    }

    const baseName = file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);

    // Different folders for different image types
    let folder = "apple-gadgets/products";

    if (file.fieldname === "colorImages") {
      folder = "apple-gadgets/product-colors";
    } else if (
      file.fieldname === "descriptionSectionImages"
    ) {
      folder = "apple-gadgets/product-descriptions";
    }

    return {
      folder,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      public_id: `${baseName}-${Date.now()}-${Math.round(
        Math.random() * 100000
      )}`,
    };
  },
});

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG and WEBP images are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 50,
  },
});

export default upload;
