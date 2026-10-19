import { Router } from "express";
import {
  createPharmacyController,
  getAllPharmaciesController,
  getPharmacyByIdController,
  updatePharmacyController,
  deactivatePharmacyController,
  getMyPharmaciesController,
  nearbyPharmaciesController
} from "../controllers/pharmacy.controller";
import { authenticate, authorize, requirePharmacyAccess } from "../middleware/auth.middleware";

const router = Router();

// Public: users search and view pharmacies.
router.get("/", getAllPharmaciesController);
router.get("/nearby", nearbyPharmaciesController);
router.get("/:id", getPharmacyByIdController);
router.get(
  "/mine",
  authenticate,
  authorize("PHARMACY_OWNER", "ADMIN"),
  getMyPharmaciesController
);

// Protected.
router.post("/", authenticate, authorize("PHARMACY_OWNER", "ADMIN"), createPharmacyController);
router.patch("/:id", authenticate, authorize("PHARMACY_OWNER", "ADMIN"), requirePharmacyAccess, updatePharmacyController);
router.patch("/:id/deactivate", authenticate, authorize("PHARMACY_OWNER", "ADMIN"), requirePharmacyAccess, deactivatePharmacyController);


export default router;