
import mongoose from "mongoose";
import Inventory from "../models/Inventory";
import StockHistory, {
  StockMovementType,
} from "../models/StockHistory";

interface UpdateStockInput {
  pharmacyId: string;
  medicineId: string;
  userId: string;
  movementType: StockMovementType;
  quantityChange: number;
  note?: string;
}

interface UpdateStockResult {
  inventoryId: string;
  previousQuantity: number;
  quantityAfter: number;
  quantityChange: number;
  movementType: StockMovementType;
}

export async function updateStock(
  input: UpdateStockInput
): Promise<UpdateStockResult> {
  const {
    pharmacyId,
    medicineId,
    userId,
    movementType,
    quantityChange,
    note,
  } = input;

  if (
    !mongoose.isValidObjectId(pharmacyId) ||
    !mongoose.isValidObjectId(medicineId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw new Error("Invalid pharmacy, medicine, or user ID.");
  }

  if (
    !Number.isInteger(quantityChange) ||
    quantityChange === 0
  ) {
    throw new Error("Quantity change must be a non-zero integer.");
  }

  const allowedMovements: StockMovementType[] = [
    "SALE",
    "RESTOCK",
    "ADJUSTMENT",
    "EXPIRED",
    "DAMAGED",
  ];

  if (!allowedMovements.includes(movementType)) {
    throw new Error("Unsupported stock movement type.");
  }

  const session = await mongoose.startSession();

  try {
    let result: UpdateStockResult | undefined;

    await session.withTransaction(async () => {
      const inventory = await Inventory.findOne({
        pharmacyId,
        medicineId,
      }).session(session);

      if (!inventory) {
        throw new Error("Inventory record not found.");
      }

      const previousQuantity = inventory.quantity;
      const quantityAfter = previousQuantity + quantityChange;

      if (quantityAfter < 0) {
        throw new Error("Insufficient stock for this operation.");
      }

      // Update the current stock.
      inventory.quantity = quantityAfter;
      inventory.lastUpdatedBy = new mongoose.Types.ObjectId(userId);
      inventory.lastStockUpdatedAt = new Date();

      await inventory.save({ session });

      // Save the corresponding stock history.
      await StockHistory.create(
        [
          {
            pharmacyId,
            medicineId,
            inventoryId: inventory._id,
            movementType,
            quantityChange,
            quantityAfter,
            recordedBy: userId,
            note,
            recordedAt: new Date(),
          },
        ],
        { session }
      );

      result = {
        inventoryId: inventory._id.toString(),
        previousQuantity,
        quantityAfter,
        quantityChange,
        movementType,
      };
    });

    if (!result) {
      throw new Error("Stock update did not complete.");
    }

    return result;
  } finally {
    await session.endSession();
  }
}
