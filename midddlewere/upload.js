import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudnary.js";

const storage = new CloudinaryStorage({
  cloudinary,

  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/");

    const ext = file.mimetype === "application/pdf"
      ? "pdf"
      : file.mimetype === "application/msword"
        ? "doc"
        : "docx";

    // extension সহ unique নাম বানানো
    const baseName = file.originalname
      .replace(/\.[^/.]+$/, "")   // আসল extension বাদ
      .replace(/\s+/g, "_");      // space সরানো (safe url এর জন্য)

    return {
      folder: isImage ? "students/images" : "students/files",
      resource_type: isImage ? "image" : "raw",
      format: isImage ? undefined : ext,
      public_id: isImage
        ? undefined
        : `${baseName}-${Date.now()}.${ext}`,   // 👈 এখানেই extension force করা হচ্ছে
      allowed_formats: isImage
        ? ["jpg", "jpeg", "png", "webp"]
        : ["pdf", "doc", "docx"],
    };
  },
});
const upload = multer({
  storage,
});

export default upload;