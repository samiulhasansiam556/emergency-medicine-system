
import { Request, Response } from "express";
import mongoose from "mongoose";
import { updateStock,setStock } from "../services/inventory.service";
import { StockMovementType } from "../models/StockHistory";
import { sendError } from "../utils/respond";
import { recordSale } from "../services/sale.service";

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


export async function setStockController(req: Request, res: Response): Promise<void> {
  try {
    const { pharmacyId, medicineId, quantity, note } = req.body ?? {};

    if (
      typeof pharmacyId !== "string" || typeof medicineId !== "string" ||
      !mongoose.isValidObjectId(pharmacyId) || !mongoose.isValidObjectId(medicineId)
    ) {
      res.status(400).json({ success: false, message: "Valid pharmacyId and medicineId are required." });
      return;
    }
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0) {
      res.status(400).json({ success: false, message: "quantity must be a non-negative integer." });
      return;
    }
    if (note !== undefined && typeof note !== "string") {
      res.status(400).json({ success: false, message: "note must be a string." });
      return;
    }

    const data = await setStock({
      pharmacyId, medicineId, userId: req.user!.id, newQuantity: quantity, note,
    });
    res.status(200).json({ success: true, message: "Stock set.", data });
  } catch (error) {
    sendError(res, error, "Set stock");
  }
}

export async function recordSaleController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      pharmacyId,
      medicineId,
      requestedQuantity,
      fulfilledQuantity,
    } = req.body ?? {};

    if (
      typeof pharmacyId !== "string" ||
      typeof medicineId !== "string" ||
      !mongoose.isValidObjectId(pharmacyId) ||
      !mongoose.isValidObjectId(medicineId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid pharmacyId and medicineId are required.",
      });
      return;
    }

    if (
      typeof requestedQuantity !== "number" ||
      typeof fulfilledQuantity !== "number"
    ) {
      res.status(400).json({
        success: false,
        message: "requestedQuantity and fulfilledQuantity must be numbers.",
      });
      return;
    }

    const data = await recordSale({
      pharmacyId,
      medicineId,
      userId: req.user!.id,
      requestedQuantity,
      fulfilledQuantity,
    });

    res.status(201).json({
      success: true,
      message: "Sale and demand recorded successfully.",
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    if (
      message.startsWith("Invalid ") ||
      message.startsWith("Invalid requested")
    ) {
      res.status(400).json({ success: false, message });
      return;
    }

    if (
      message === "Insufficient stock for this sale."
    ) {
      res.status(409).json({ success: false, message });
      return;
    }

    if (
      message === "Pharmacy not found." ||
      message === "Medicine not found." ||
      message === "Inventory record not found."
    ) {
      res.status(404).json({ success: false, message });
      return;
    }

    console.error("Sale recording failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to record sale.",
    });
  }
}