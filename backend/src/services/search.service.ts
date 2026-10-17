import mongoose from "mongoose";
import Medicine from "../models/Medicine";
import Inventory from "../models/Inventory";
import Pharmacy from "../models/Pharmacy";
import { getStockStatus } from "./inventoryRecord.service";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface SearchParams {
  q?: string;
  medicineId?: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  limit: number;
}

export async function searchNearbyAvailability(params: SearchParams) {
  const { q, medicineId, latitude, longitude, radiusKm, limit } = params;

  // 1. Which medicines match the search?
  let medicineIds: mongoose.Types.ObjectId[] = [];

  if (medicineId) {
    if (!mongoose.isValidObjectId(medicineId)) {
      throw new Error("Invalid medicine ID.");
    }
    medicineIds = [new mongoose.Types.ObjectId(medicineId)];
  } else if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    const matches = await Medicine.find({
      isActive: true,
      $or: [{ name: regex }, { genericName: regex }],
    })
      .select("_id")
      .limit(50)
      .lean();
    medicineIds = matches.map((m) => m._id);
  }

  if (medicineIds.length === 0) {
    return { radiusKm, count: 0, data: [] };
  }

  // 2. Which pharmacies have stock (quantity > 0)?
  const inventories = await Inventory.find({
    medicineId: { $in: medicineIds },
    quantity: { $gt: 0 },
  })
    .populate("medicineId", "name genericName strength dosageForm")
    .lean();

  if (inventories.length === 0) {
    return { radiusKm, count: 0, data: [] };
  }

  const pharmacyIds = [...new Set(inventories.map((i) => i.pharmacyId.toString()))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  // 3. Of those, which are within the radius? $geoNear sorts nearest first.
  const nearby = await Pharmacy.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [longitude, latitude] },
        distanceField: "distanceMeters",
        maxDistance: radiusKm * 1000,
        spherical: true,
        key: "geo",
        query: { _id: { $in: pharmacyIds }, isActive: true },
      },
    },
    { $limit: limit },
    {
      $project: {
        name: 1,
        address: 1,
        city: 1,
        phone: 1,
        imageUrl: 1,
        location: 1,
        distanceMeters: 1,
      },
    },
  ]);

  // 4. Attach the available medicines to each pharmacy.
  const now = Date.now();

  const data = nearby.map((pharmacy) => {
    const available = inventories
      .filter((i) => i.pharmacyId.toString() === pharmacy._id.toString())
      .map((i) => ({
        medicine: i.medicineId,
        status: getStockStatus(i.quantity, i.reorderLevel),
        lastStockUpdatedAt: i.lastStockUpdatedAt,
        minutesSinceUpdate: Math.round((now - new Date(i.lastStockUpdatedAt).getTime()) / 60000),
      }));

    return {
      pharmacy: {
        id: pharmacy._id,
        name: pharmacy.name,
        address: pharmacy.address,
        city: pharmacy.city,
        phone: pharmacy.phone,
        imageUrl: pharmacy.imageUrl,
        location: pharmacy.location,
      },
      distanceKm: Math.round((pharmacy.distanceMeters / 1000) * 100) / 100,
      available,
    };
  });

  return { radiusKm, count: data.length, data };
}