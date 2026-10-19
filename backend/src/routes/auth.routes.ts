import { Router } from "express";
import {
  registerController, loginController, meController,
  updateProfileController, changePasswordController,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);

router.get("/me",authenticate, meController);

router.patch("/profile-update", authenticate, updateProfileController);
router.patch("/me/password-update", authenticate, changePasswordController);

export default router;