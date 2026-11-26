import { Router } from "express";
import { updateStockController, setStockController,recordSaleController, } from "../controllers/inventory.controller";
import {
  createInventoryController,
  listPharmacyInventoryController,
  updateReorderLevelController,
  removeInventoryController,
  bulkInventoryController,
  
} from "../controllers/inventoryRecord.controller";
import {
  authenticate,
  authorize,
  requirePharmacyAccess,
  requireInventoryAccess,
} from "../middleware/auth.middleware";

const router = Router();

const roles = [authenticate, authorize("PHARMACY_OWNER", "ADMIN")];
const ownerOnly = [...roles, requirePharmacyAccess];

// Public: users can see what a pharmacy has. ?q=&status=&sort=&page=&limit=
router.get("/pharmacy/:pharmacyId", listPharmacyInventoryController);

// Protected (pharmacyId comes from the body)
router.post("/", ...ownerOnly, createInventoryController);
router.post("/bulk", ...ownerOnly, bulkInventoryController);
router.patch("/stock", ...ownerOnly, updateStockController);
router.patch("/stock/set", ...ownerOnly, setStockController);
router.patch("/reorder-level", ...ownerOnly, updateReorderLevelController);
router.post("/sale", ...ownerOnly, recordSaleController);
// Protected (:id is the inventory record id)
router.delete("/:id", ...roles, requireInventoryAccess, removeInventoryController);

export default router;