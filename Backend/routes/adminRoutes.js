import express from "express";
import { protect } from "../middleware/protect.js";
import { getMe } from "../controllers/adminController.js";

const routerAdmin = express.Router();

routerAdmin.get("/me", protect, getMe);

export default routerAdmin;
