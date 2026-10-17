import { Router } from "express";
import { searchMedicineController } from "../controllers/search.controller";

const router = Router();

// Public: anyone in an emergency should be able to search.
router.get("/medicines", searchMedicineController);

export default router;