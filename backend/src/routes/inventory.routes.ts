import { Router } from "express";
import { updateStockController } from "../controllers/inventory.controller";
import {
  createInventoryController,
  listPharmacyInventoryController,
  updateReorderLevelController,
} from "../controllers/inventoryRecord.controller";
import { authenticate, authorize, requirePharmacyAccess } from "../middleware/auth.middleware";

const router = Router();

const ownerOnly = [authenticate, authorize("PHARMACY_OWNER", "ADMIN"), requirePharmacyAccess];

// Public: users can see what a pharmacy has.
router.get("/pharmacy/:pharmacyId", listPharmacyInventoryController);

// Protected
router.post("/", ...ownerOnly, createInventoryController);
router.patch("/stock", ...ownerOnly, updateStockController);
router.patch("/reorder-level", ...ownerOnly, updateReorderLevelController);

export default router;