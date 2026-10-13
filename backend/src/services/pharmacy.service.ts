
import mongoose from "mongoose";
import Pharmacy from "../models/Pharmacy";

interface CreatePharmacyInput {
  name: string;
  ownerId: string;
  address: string;
  city: string;
  phone: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
}

export async function createPharmacy(input: CreatePharmacyInput) {
  const {
    name,
    ownerId,
    address,
    city,
    phone,
    imageUrl,
    latitude,
    longitude,
  } = input;

  if (!mongoose.isValidObjectId(ownerId)) {
    throw new Error("Invalid owner ID.");
  }

  const location =
    latitude !== undefined && longitude !== undefined
      ? { latitude, longitude }
      : undefined;

  const pharmacy = await Pharmacy.create({
    name,
    ownerId,
    address,
    city,
    phone,
    imageUrl,
    location,
  });

  return pharmacy;
}

export async function getAllPharmacies() {
  return Pharmacy.find({ isActive: true })
    .select("-__v")
    .sort({ createdAt: -1 })
    .lean();
}

export async function getPharmacyById(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error("Invalid pharmacy ID.");
  }

  const pharmacy = await Pharmacy.findOne({
    _id: id,
    isActive: true,
  })
    .select("-__v")
    .lean();

  if (!pharmacy) {
    throw new Error("Pharmacy not found.");
  }

  return pharmacy;
}


export async function updatePharmacy(
  id: string,
  input: Partial<{
    name: string;
    address: string;
    city: string;
    phone: string;
    imageUrl: string;
    latitude: number;
    longitude: number;
  }>
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error("Invalid pharmacy ID.");
  }

  const updates: Record<string, unknown> = {};

  for (const key of ["name", "address", "city", "phone", "imageUrl"] as const) {
    if (input[key] !== undefined) updates[key] = input[key];
  }

  if (input.latitude !== undefined || input.longitude !== undefined) {
    if (
      typeof input.latitude !== "number" ||
      typeof input.longitude !== "number" ||
      input.latitude < -90 || input.latitude > 90 ||
      input.longitude < -180 || input.longitude > 180
    ) {
      throw new Error("Valid latitude and longitude are required together.");
    }

    updates.location = {
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }

  const pharmacy = await Pharmacy.findOneAndUpdate(
    { _id: id, isActive: true },
    { $set: updates },
    { new: true, runValidators: true }
  ).select("-__v");

  if (!pharmacy) throw new Error("Pharmacy not found.");

  return pharmacy;
}

export async function deactivatePharmacy(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error("Invalid pharmacy ID.");
  }

  const pharmacy = await Pharmacy.findOneAndUpdate(
    { _id: id, isActive: true },
    { $set: { isActive: false } },
    { new: true }
  ).select("-__v");

  if (!pharmacy) throw new Error("Pharmacy not found.");

  return pharmacy;
}