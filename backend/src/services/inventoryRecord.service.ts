import mongoose from "mongoose";
import Pharmacy from "../models/Pharmacy";
import Medicine from "../models/Medicine";
import Inventory from "../models/Inventory";
import StockHistory from "../models/StockHistory";

export type StockStatus = "AVAILABLE" | "LOW" | "OUT_OF_STOCK";

export function getStockStatus(quantity: number, reorderLevel: number): StockStatus {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= reorderLevel) return "LOW";
  return "AVAILABLE";
}

interface CreateInventoryInput {
  pharmacyId: string;
  medicineId: string;
  quantity: number;
  reorderLevel?: number;
  userId: string;
}

export async function createInventory(input: CreateInventoryInput) {
  const { pharmacyId, medicineId, quantity, userId } = input;
  const reorderLevel = input.reorderLevel ?? 20;

  if (
    !mongoose.isValidObjectId(pharmacyId) ||
    !mongoose.isValidObjectId(medicineId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw new Error("Invalid pharmacy, medicine, or user ID.");
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("Invalid quantity.");
  }

  if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
    throw new Error("Invalid reorder level.");
  }

  const [pharmacy, medicine] = await Promise.all([
    Pharmacy.exists({ _id: pharmacyId, isActive: true }),
    Medicine.exists({ _id: medicineId, isActive: true }),
  ]);

  if (!pharmacy) throw new Error("Pharmacy not found.");
  if (!medicine) throw new Error("Medicine not found.");

  const session = await mongoose.startSession();

  try {
    let inventoryId = "";

    await session.withTransaction(async () => {
      const [inventory] = await Inventory.create(
        [
          {
            pharmacyId,
            medicineId,
            quantity,
            reorderLevel,
            lastUpdatedBy: userId,
            lastStockUpdatedAt: new Date(),
          },
        ],
        { session }
      );

      await StockHistory.create(
        [
          {
            pharmacyId,
            medicineId,
            inventoryId: inventory._id,
            movementType: "INITIAL_STOCK",
            quantityChange: quantity,
            quantityAfter: quantity,
            recordedBy: userId,
            note: "Initial stock",
            recordedAt: new Date(),
          },
        ],
        { session }
      );

      inventoryId = inventory._id.toString();
    });

    return { inventoryId, pharmacyId, medicineId, quantity, reorderLevel };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new Error("Inventory already exists for this pharmacy and medicine.");
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function listPharmacyInventory(pharmacyId: string) {
  if (!mongoose.isValidObjectId(pharmacyId)) {
    throw new Error("Invalid pharmacy ID.");
  }

  const pharmacy = await Pharmacy.exists({ _id: pharmacyId, isActive: true });
  if (!pharmacy) throw new Error("Pharmacy not found.");

  const items = await Inventory.find({ pharmacyId })
    .populate("medicineId", "name genericName strength dosageForm category")
    .sort({ updatedAt: -1 })
    .lean();

  return items.map((item) => ({
    inventoryId: item._id,
    medicine: item.medicineId,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    status: getStockStatus(item.quantity, item.reorderLevel),
    lastStockUpdatedAt: item.lastStockUpdatedAt,
  }));
}

export async function updateReorderLevel(input: {
  pharmacyId: string;
  medicineId: string;
  reorderLevel: number;
  userId: string;
}) {
  const { pharmacyId, medicineId, reorderLevel, userId } = input;

  if (!mongoose.isValidObjectId(pharmacyId) || !mongoose.isValidObjectId(medicineId)) {
    throw new Error("Invalid pharmacy or medicine ID.");
  }

  if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
    throw new Error("Invalid reorder level.");
  }

  const inventory = await Inventory.findOneAndUpdate(
    { pharmacyId, medicineId },
    { $set: { reorderLevel, lastUpdatedBy: userId } },
    { new: true, runValidators: true }
  ).select("-__v");

  if (!inventory) throw new Error("Inventory record not found.");
  return inventory;
}