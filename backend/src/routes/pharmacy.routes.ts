import { Router } from "express";
import {
  createPharmacyController,
  getAllPharmaciesController,
  getPharmacyByIdController,
  updatePharmacyController,
  deactivatePharmacyController,
} from "../controllers/pharmacy.controller";

const router = Router();

router.post("/", createPharmacyController);
router.get("/", getAllPharmaciesController);
router.get("/:id", getPharmacyByIdController);
router.patch("/:id", updatePharmacyController);
router.patch("/:id/deactivate", deactivatePharmacyController);

export default router;