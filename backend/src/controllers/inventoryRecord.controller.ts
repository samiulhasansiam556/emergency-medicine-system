import { Request, Response } from "express";
import {
  createInventory,
  listPharmacyInventory,
  updateReorderLevel,
  removeInventory,
  bulkUpsertInventory
  
} from "../services/inventoryRecord.service";

import { readPaging, readString } from "../utils/respond";
import type { StockStatus } from "../services/inventoryRecord.service";

const STATUSES: StockStatus[] = ["AVAILABLE", "LOW", "OUT_OF_STOCK"];

function handleError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error.";

  if (message.startsWith("Invalid ")) {
    res.status(400).json({ success: false, message });
  } else if (message.endsWith("not found.")) {
    res.status(404).json({ success: false, message });
  } else if (message.startsWith("Inventory already exists")) {
    res.status(409).json({ success: false, message });
  } else if (error instanceof Error && error.name === "ValidationError") {
    res.status(400).json({ success: false, message: "Invalid inventory data." });
  } else {
    console.error("Inventory API error:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}

export async function createInventoryController(req: Request, res: Response) {
  try {
    const { pharmacyId, medicineId, quantity, reorderLevel } = req.body;

    if (typeof pharmacyId !== "string" || typeof medicineId !== "string") {
      res.status(400).json({
        success: false,
        message: "pharmacyId and medicineId are required.",
      });
      return;
    }

    if (typeof quantity !== "number") {
      res.status(400).json({ success: false, message: "quantity must be a number." });
      return;
    }

    if (reorderLevel !== undefined && typeof reorderLevel !== "number") {
      res.status(400).json({ success: false, message: "reorderLevel must be a number." });
      return;
    }

    const result = await createInventory({
      pharmacyId,
      medicineId,
      quantity,
      reorderLevel,
      userId: req.user!.id,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
}
export async function listPharmacyInventoryController(req: Request, res: Response) {
  try {
    const status = readString(req.query.status);
    if (status && !STATUSES.includes(status as StockStatus)) {
      res.status(400).json({ success: false, message: "Invalid status." });
      return;
    }

    const { page, limit } = readPaging(req, 100, 200);

    const result = await listPharmacyInventory(req.params.pharmacyId as string, {
      q: readString(req.query.q),
      status: status as StockStatus | undefined,
      sort: req.query.sort === "stock" ? "stock" : "recent",
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      count: result.data.length,
      total: result.total,
      page,
      limit,
      data: result.data,
    });
  } catch (error) {
    handleError(res, error);
  }
}

export async function removeInventoryController(req: Request, res: Response) {
  try {
    const data = await removeInventory(req.params.id as string);
    res.status(200).json({ success: true, message: "Medicine removed from inventory.", data });
  } catch (error) {
    handleError(res, error);
  }
}

export async function bulkInventoryController(req: Request, res: Response) {
  try {
    const { pharmacyId, items } = req.body ?? {};
    if (typeof pharmacyId !== "string" || !Array.isArray(items)) {
      res.status(400).json({ success: false, message: "pharmacyId and items[] are required." });
      return;
    }

    const data = await bulkUpsertInventory({ pharmacyId, userId: req.user!.id, items });
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
}
export async function updateReorderLevelController(req: Request, res: Response) {
  try {
    const { pharmacyId, medicineId, reorderLevel } = req.body;

    if (
      typeof pharmacyId !== "string" ||
      typeof medicineId !== "string" ||
      typeof reorderLevel !== "number"
    ) {
      res.status(400).json({
        success: false,
        message: "pharmacyId, medicineId, and numeric reorderLevel are required.",
      });
      return;
    }

    const inventory = await updateReorderLevel({
      pharmacyId,
      medicineId,
      reorderLevel,
      userId: req.user!.id,
    });

    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    handleError(res, error);
  }
}