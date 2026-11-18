import { Router } from "express";
import { listDepartments } from "../controllers/department.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listDepartments);

export default router;
