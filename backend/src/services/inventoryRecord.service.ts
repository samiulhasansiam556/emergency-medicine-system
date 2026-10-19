import mongoose from "mongoose";
import Pharmacy from "../models/Pharmacy";
import Medicine from "../models/Medicine";
import Inventory from "../models/Inventory";
import StockHistory from "../models/StockHistory";
import { setStock } from "./inventory.service";


export const STALE_HOURS = 24;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

interface ListInventoryOptions {
  q?: string;
  status?: StockStatus;
  sort?: "recent" | "stock";
  page?: number;
  limit?: number;
}

export async function listPharmacyInventory(pharmacyId: string, opts: ListInventoryOptions = {}) {
  if (!mongoose.isValidObjectId(pharmacyId)) {
    throw new Error("Invalid pharmacy ID.");
  }

  const pharmacy = await Pharmacy.exists({ _id: pharmacyId, isActive: true });
  if (!pharmacy) throw new Error("Pharmacy not found.");

  const { q, status, sort = "recent", page = 1, limit = 100 } = opts;

  const filter: Record<string, unknown> = { pharmacyId };

  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    const medicines = await Medicine.find({ $or: [{ name: regex }, { genericName: regex }] })
      .select("_id")
      .limit(200)
      .lean();
    filter.medicineId = { $in: medicines.map((m) => m._id) };
  }

  if (status === "OUT_OF_STOCK") {
    filter.quantity = 0;
  } else if (status === "LOW") {
    filter.quantity = { $gt: 0 };
    filter.$expr = { $lte: ["$quantity", "$reorderLevel"] };
  } else if (status === "AVAILABLE") {
    filter.$expr = { $gt: ["$quantity", "$reorderLevel"] };
  }

  const order: Record<string, 1 | -1> =
    sort === "stock" ? { quantity: 1, _id: 1 } : { updatedAt: -1, _id: 1 };

  const [items, total] = await Promise.all([
    Inventory.find(filter)
      .populate("medicineId", "name genericName strength dosageForm category")
      .sort(order)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Inventory.countDocuments(filter),
  ]);

  const staleBefore = Date.now() - STALE_HOURS * 3600 * 1000;

  const data = items.map((item) => ({
    inventoryId: item._id,
    medicine: item.medicineId,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    status: getStockStatus(item.quantity, item.reorderLevel),
    lastStockUpdatedAt: item.lastStockUpdatedAt,
    isStale: new Date(item.lastStockUpdatedAt).getTime() < staleBefore,
  }));

  return { data, total };
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

export async function removeInventory(inventoryId: string) {
  if (!mongoose.isValidObjectId(inventoryId)) {
    throw new Error("Invalid inventory ID.");
  }

  // StockHistory / snapshots are kept on purpose (the ML pipeline needs them).
  const removed = await Inventory.findByIdAndDelete(inventoryId).select("pharmacyId medicineId");
  if (!removed) throw new Error("Inventory record not found.");

  return {
    inventoryId,
    pharmacyId: removed.pharmacyId.toString(),
    medicineId: removed.medicineId.toString(),
  };
}

interface BulkItem {
  medicineId: string;
  quantity: number;
  reorderLevel?: number;
}

// Creates the record if it does not exist, otherwise sets the quantity (stocktake).
export async function bulkUpsertInventory(input: {
  pharmacyId: string;
  userId: string;
  items: BulkItem[];
}) {
  const { pharmacyId, userId, items } = input;

  if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
    throw new Error("Invalid items. Send between 1 and 200 items.");
  }

  const results: {
    row: number;
    medicineId: unknown;
    ok: boolean;
    action?: "CREATED" | "UPDATED";
    error?: string;
  }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = i + 1;

    try {
      if (!item || typeof item.medicineId !== "string" || !mongoose.isValidObjectId(item.medicineId)) {
        throw new Error("Invalid medicine ID.");
      }

      const exists = await Inventory.exists({ pharmacyId, medicineId: item.medicineId });

      if (exists) {
        await setStock({
          pharmacyId,
          medicineId: item.medicineId,
          userId,
          newQuantity: item.quantity,
          note: "Bulk import",
        });
        if (item.reorderLevel !== undefined) {
          await updateReorderLevel({
            pharmacyId,
            medicineId: item.medicineId,
            reorderLevel: item.reorderLevel,
            userId,
          });
        }
        results.push({ row, medicineId: item.medicineId, ok: true, action: "UPDATED" });
      } else {
        await createInventory({
          pharmacyId,
          medicineId: item.medicineId,
          quantity: item.quantity,
          reorderLevel: item.reorderLevel,
          userId,
        });
        results.push({ row, medicineId: item.medicineId, ok: true, action: "CREATED" });
      }
    } catch (error) {
      results.push({
        row,
        medicineId: item?.medicineId,
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error.",
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return { total: items.length, succeeded, failed: items.length - succeeded, results };
}