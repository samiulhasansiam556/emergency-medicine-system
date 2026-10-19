import { Router } from "express";
import {
  riskSummaryController,
  riskListController,
  riskHistoryController
} from "../controllers/risk.controller";
import {
  authenticate,
  authorize,
  requirePharmacyScope,
} from "../middleware/auth.middleware";

const router = Router();

// Owners see only their own pharmacy; admins can see one or all.
router.use(authenticate, authorize("PHARMACY_OWNER", "ADMIN"));

router.get("/summary", requirePharmacyScope, riskSummaryController);
router.get("/", requirePharmacyScope, riskListController);
router.get("/history", requirePharmacyScope, riskHistoryController);
export default router;