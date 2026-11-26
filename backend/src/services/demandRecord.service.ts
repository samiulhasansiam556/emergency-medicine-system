
import mongoose from "mongoose";
import DemandRecord from "../models/DemandRecord";
import Pharmacy from "../models/Pharmacy";
import Medicine from "../models/Medicine";

interface CreateDemandInput {
  pharmacyId: string;
  medicineId: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  userId: string;
}

export async function createDemandRecord(input: CreateDemandInput) {
  const {
    pharmacyId,
    medicineId,
    requestedQuantity,
    fulfilledQuantity,
    userId,
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
    requestedQuantity < 0
  ) {
    throw new Error("Invalid requested quantity.");
  }

  if (
    !Number.isInteger(fulfilledQuantity) ||
    fulfilledQuantity < 0 ||
    fulfilledQuantity > requestedQuantity
  ) {
    throw new Error("Invalid fulfilled quantity.");
  }

  const [pharmacy, medicine] = await Promise.all([
    Pharmacy.exists({ _id: pharmacyId, isActive: true }),
    Medicine.exists({ _id: medicineId, isActive: true }),
  ]);

  if (!pharmacy) throw new Error("Pharmacy not found.");
  if (!medicine) throw new Error("Medicine not found.");

  const unmetQuantity = requestedQuantity - fulfilledQuantity;

  const record = await DemandRecord.create({
    pharmacyId,
    medicineId,
    requestedQuantity,
    fulfilledQuantity,
    unmetQuantity,
    recordedBy: userId,
    source: "PHARMACY",
    recordedAt: new Date(),
  });

  return record;
}

export async function listDemandRecords(
  pharmacyId: string,
  page = 1,
  limit = 20
) {
  if (!mongoose.isValidObjectId(pharmacyId)) {
    throw new Error("Invalid pharmacy ID.");
  }

  const pharmacy = await Pharmacy.exists({
    _id: pharmacyId,
    isActive: true,
  });

  if (!pharmacy) throw new Error("Pharmacy not found.");

  const filter = { pharmacyId };

  const [items, total] = await Promise.all([
    DemandRecord.find(filter)
      .populate("medicineId", "name genericName strength dosageForm")
      .populate("recordedBy", "name email")
      .sort({ recordedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    DemandRecord.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
