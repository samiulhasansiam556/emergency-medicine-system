

import { Router } from "express";
import { ownerDashboardController } from "../controllers/dashboard.controller";
import { authenticate, authorize, requirePharmacyAccess } from "../middleware/auth.middleware";

const router = Router();

// requirePharmacyAccess reads ?pharmacyId= and checks ownership.
router.get(
  "/owner",
  authenticate,
  authorize("PHARMACY_OWNER", "ADMIN"),
  requirePharmacyAccess,
  ownerDashboardController
);

export default router;