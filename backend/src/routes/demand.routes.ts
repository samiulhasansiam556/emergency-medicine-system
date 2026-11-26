
import { Router } from "express";

import {
  createDemandRecordController,
  listDemandRecordsController,
} from "../controllers/demandRecord.controller";

import {
  authenticate,
  authorize,
  requirePharmacyAccess,
} from "../middleware/auth.middleware";

const router = Router();

const ownerOnly = [
  authenticate,
  authorize("PHARMACY_OWNER", "ADMIN"),
];

// Create demand record
router.post(
  "/",
  ...ownerOnly,
  requirePharmacyAccess,
  createDemandRecordController
);

// Get pharmacy demand history
router.get(
  "/pharmacy/:id",
  ...ownerOnly,
  requirePharmacyAccess,
  listDemandRecordsController
);

export default router;
