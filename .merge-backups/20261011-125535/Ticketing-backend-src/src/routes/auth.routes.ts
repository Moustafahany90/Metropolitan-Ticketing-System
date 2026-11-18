import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { loginSchema, refreshSchema } from "../schemas/auth.schema";

const router = Router();

router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);
router.get("/ad-status", authController.adStatus);

export default router;
