import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || "ddcvhxwgh",
  api_key: process.env.API_KEY || "566772359129773",
  api_secret: process.env.API_SECRET || "E31N_cM-eduiUDxfhNFABgA4l48",
});

export default cloudinary;
