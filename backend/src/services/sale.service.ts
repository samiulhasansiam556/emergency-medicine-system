
import mongoose from "mongoose";
import Pharmacy from "../models/Pharmacy";
import Medicine from "../models/Medicine";
import Inventory from "../models/Inventory";
import StockHistory from "../models/StockHistory";
import DemandRecord from "../models/DemandRecord";

interface RecordSaleInput {
  pharmacyId: string;
  medicineId: string;
  userId: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
}

export async function recordSale(input: RecordSaleInput) {
  const {
    pharmacyId,
    medicineId,
    userId,
    requestedQuantity,
    fulfilledQuantity,
  } = input;

  if (
    !mongoose.isValidObjectId(pharmacyId) ||
    !mongoose.isValidObjectId(medicineId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw new Error("Invalid pharmacy, medicine, or user ID.");
  }

  if (
    !Number.isInteger(requestedQuantity) ||
    requestedQuantity <= 0 ||
    !Number.isInteger(fulfilledQuantity) ||
    fulfilledQuantity < 0 ||
    fulfilledQuantity > requestedQuantity
  ) {
    throw new Error("Invalid requested or fulfilled quantity.");
  }

  const session = await mongoose.startSession();

  try {
    let result:
      | {
          inventoryId: string;
          previousQuantity: number;
          quantityAfter: number;
          requestedQuantity: number;
          fulfilledQuantity: number;
          unmetQuantity: number;
        }
      | undefined;

    await session.withTransaction(async () => {
     const pharmacy = await Pharmacy.findOne({
  _id: pharmacyId,
  isActive: true,
}).session(session);

const medicine = await Medicine.findOne({
  _id: medicineId,
  isActive: true,
}).session(session);

      if (!pharmacy) throw new Error("Pharmacy not found.");
      if (!medicine) throw new Error("Medicine not found.");

      const inventory = await Inventory.findOne({
        pharmacyId,
        medicineId,
      }).session(session);

      if (!inventory) {
        throw new Error("Inventory record not found.");
      }

      const previousQuantity = inventory.quantity;

      if (fulfilledQuantity > previousQuantity) {
        throw new Error("Insufficient stock for this sale.");
      }

      const quantityAfter = previousQuantity - fulfilledQuantity;
      const unmetQuantity = requestedQuantity - fulfilledQuantity;
      const recordedAt = new Date();

      // Update stock only when some quantity was actually fulfilled.
      if (fulfilledQuantity > 0) {
        inventory.quantity = quantityAfter;
        inventory.lastUpdatedBy = new mongoose.Types.ObjectId(userId);
        inventory.lastStockUpdatedAt = recordedAt;

        await inventory.save({ session });

        await StockHistory.create(
          [
            {
              pharmacyId,
              medicineId,
              inventoryId: inventory._id,
              movementType: "SALE",
              quantityChange: -fulfilledQuantity,
              quantityAfter,
              recordedBy: userId,
              note: `Sale: requested ${requestedQuantity}, fulfilled ${fulfilledQuantity}, unmet ${unmetQuantity}`,
              recordedAt,
            },
          ],
          { session }
        );
      }

      // Always save demand, including fully unmet demand.
      await DemandRecord.create(
        [
          {
            pharmacyId,
            medicineId,
            requestedQuantity,
            fulfilledQuantity,
            unmetQuantity,
            recordedBy: userId,
            source: "PHARMACY",
            recordedAt,
          },
        ],
        { session }
      );

      result = {
        inventoryId: inventory._id.toString(),
        previousQuantity,
        quantityAfter,
        requestedQuantity,
        fulfilledQuantity,
        unmetQuantity,
      };
    });

    if (!result) {
      throw new Error("Sale operation did not complete.");
    }

    return result;
  } finally {
    await session.endSession();
  }
}
