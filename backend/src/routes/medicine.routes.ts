import { Router } from "express";
import {
  createMedicineController,
  searchMedicinesController,
  getMedicineByIdController,
  updateMedicineController,
  deactivateMedicineController,
  listCategoriesController
} from "../controllers/medicine.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

// Public
router.get("/", searchMedicinesController);
router.get("/categories", listCategoriesController);
router.get("/:id", getMedicineByIdController);

// Pharmacy owners can add medicines to the catalog; only admins edit or remove.
router.post("/", authenticate, authorize("PHARMACY_OWNER", "ADMIN"), createMedicineController);
router.patch("/:id", authenticate, authorize("ADMIN"), updateMedicineController);
router.patch("/:id/deactivate", authenticate, authorize("ADMIN"), deactivateMedicineController);

export default router;