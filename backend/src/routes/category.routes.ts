import { Router } from "express";
import { listCategories } from "../controllers/category.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listCategories);

export default router;
