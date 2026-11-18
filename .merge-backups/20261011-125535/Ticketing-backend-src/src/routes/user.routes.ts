import { Router } from "express";
import { listTechnicians } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorize.middleware";

const router = Router();

router.get("/technicians", requireAuth, requireRole("TECHNICIAN"), listTechnicians);

export default router;
