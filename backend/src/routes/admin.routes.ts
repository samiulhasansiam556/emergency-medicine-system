import { Router } from "express";
import {
  overviewController, listUsersController, setUserStatusController,
  listPharmaciesController, activatePharmacyController,
  listMedicinesController, activateMedicineController,
  riskByMedicineController, listModelsController, activeModelController,
  deactivatePharmacyController, modelComparisonController,

} from "../controllers/admin.controller";
import { updateMedicineController, deactivateMedicineController } from "../controllers/medicine.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/overview", overviewController);

router.get("/users", listUsersController);
router.patch("/users/:id/status", setUserStatusController);

router.get("/pharmacies", listPharmaciesController);
router.patch("/pharmacies/:id/activate", activatePharmacyController);

router.get("/medicines", listMedicinesController);
router.patch("/medicines/:id", updateMedicineController);
router.patch("/medicines/:id/deactivate", deactivateMedicineController);
router.patch("/medicines/:id/activate", activateMedicineController);

router.get("/risk/by-medicine", riskByMedicineController);

router.get("/models", listModelsController);
router.get("/models/active", activeModelController);
router.patch("/pharmacies/:id/deactivate",deactivatePharmacyController);
router.get("/models/comparison", modelComparisonController); // ?version= (default: active)

export default router;