import mongoose from "mongoose";
import Medicine from "../models/Medicine";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface CreateMedicineInput {
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer?: string;
  category?: string;
}

export async function createMedicine(input: CreateMedicineInput) {
  return Medicine.create(input);
}

export async function searchMedicines(params: {
  search?: string;
  page: number;
  limit: number;
}) {
  const { search, page, limit } = params;

  const filter: Record<string, unknown> = { isActive: true };

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { genericName: regex }];
  }

  const [data, total] = await Promise.all([
    Medicine.find(filter)
      .select("-__v")
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Medicine.countDocuments(filter),
  ]);

  return { data, total, page, limit };
}

export async function getMedicineById(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error("Invalid medicine ID.");
  }

  const medicine = await Medicine.findOne({ _id: id, isActive: true })
    .select("-__v")
    .lean();

  if (!medicine) throw new Error("Medicine not found.");
  return medicine;
}

export async function updateMedicine(
  id: string,
  input: Partial<CreateMedicineInput>
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error("Invalid medicine ID.");
  }

  const updates: Record<string, unknown> = {};
  for (const key of [
    "name",
    "genericName",
    "strength",
    "dosageForm",
    "manufacturer",
    "category",
  ] as const) {
    if (input[key] !== undefined) updates[key] = input[key];
  }

  const medicine = await Medicine.findOneAndUpdate(
    { _id: id, isActive: true },
    { $set: updates },
    { new: true, runValidators: true }
  ).select("-__v");

  if (!medicine) throw new Error("Medicine not found.");
  return medicine;
}

export async function deactivateMedicine(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error("Invalid medicine ID.");
  }

  const medicine = await Medicine.findOneAndUpdate(
    { _id: id, isActive: true },
    { $set: { isActive: false } },
    { new: true }
  ).select("-__v");

  if (!medicine) throw new Error("Medicine not found.");
  return medicine;
}

export async function listCategories(): Promise<string[]> {
  const categories = (await Medicine.distinct("category", {
    isActive: true,
    category: { $exists: true, $ne: "" },
  })) as string[];
  return categories.sort((a, b) => a.localeCompare(b));
}