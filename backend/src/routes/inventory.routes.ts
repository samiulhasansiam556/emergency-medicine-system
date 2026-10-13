



import { Router } from "express";
import { updateStockController } from "../controllers/inventory.controller";

const router = Router();

router.patch("/stock", updateStockController);

export default router;
