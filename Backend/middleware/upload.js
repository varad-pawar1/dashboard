import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || "ddcvhxwgh",
  api_key: process.env.API_KEY || "566772359129773",
  api_secret: process.env.API_SECRET || "E31N_cM-eduiUDxfhNFABgA4l48",
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "chat_files";
    let resource_type = "auto";

    return {
      folder,
      resource_type,
      public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`,
    };
  },
});

export const upload = multer({ storage });
