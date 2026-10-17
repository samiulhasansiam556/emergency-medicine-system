
import { Request, Response } from "express";
import mongoose from "mongoose";
import { updateStock } from "../services/inventory.service";
import { StockMovementType } from "../models/StockHistory";

const allowedMovements: StockMovementType[] = [
  "SALE",
  "RESTOCK",
  "ADJUSTMENT",
  "EXPIRED",
  "DAMAGED",
];

export async function updateStockController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      pharmacyId,
      medicineId,
      movementType,
      quantityChange,
      note,
    } = req.body;

    const userId = req.user!.id;

    if (
      typeof pharmacyId !== "string" ||
      typeof medicineId !== "string" ||
      !mongoose.isValidObjectId(pharmacyId) ||
      !mongoose.isValidObjectId(medicineId) ||
      !mongoose.isValidObjectId(userId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid pharmacyId, medicineId are required.",
      });
      return;
    }

    if (
      typeof movementType !== "string" ||
      !allowedMovements.includes(movementType as StockMovementType)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid stock movement type.",
      });
      return;
    }

    if (
      typeof quantityChange !== "number" ||
      !Number.isInteger(quantityChange) ||
      quantityChange === 0
    ) {
      res.status(400).json({
        success: false,
        message: "quantityChange must be a non-zero integer.",
      });
      return;
    }

    if (note !== undefined && typeof note !== "string") {
      res.status(400).json({
        success: false,
        message: "note must be a string.",
      });
      return;
    }

    const result = await updateStock({
      pharmacyId,
      medicineId,
      userId,
      movementType: movementType as StockMovementType,
      quantityChange,
      note,
    });

    res.status(200).json({
      success: true,
      message: "Stock updated successfully.",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    if (
      message === "Inventory record not found." ||
      message === "Insufficient stock for this operation."
    ) {
      res.status(409).json({
        success: false,
        message,
      });
      return;
    }

    if (message === "Invalid pharmacy, medicine, or user ID.") {
      res.status(400).json({
        success: false,
        message,
      });
      return;
    }

    console.error("Stock update failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update stock.",
    });
  }
}
