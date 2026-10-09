
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudnary.js";

const storage = new CloudinaryStorage({
  cloudinary,

  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/");

    const allowedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];

    if (!allowedImageTypes.includes(file.mimetype)) {
      throw new Error("Only JPG, PNG and WEBP images are allowed.");
    }

    const baseName = file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);

    return {
      folder: "apple-gadgets/categories",

      resource_type: "image",

      allowed_formats: ["jpg", "jpeg", "png", "webp"],

      public_id: `${baseName}-${Date.now()}`,
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
  ];

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
    files: 2,
  },
});

export default upload;

