
import mongoose from "mongoose";
import Inventory from "../models/Inventory";
import DailyStockSnapshot from "../models/DailyStockSnapshot";

export async function createDailyStockSnapshots() {
  const now = new Date();

  // Bangladesh calendar date (UTC+6)
  const dhakaDate = new Date(
    `${new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now)}T00:00:00.000Z`
  );

  const inventories = await Inventory.find({})
    .select("_id pharmacyId medicineId quantity reorderLevel")
    .lean();

  if (inventories.length === 0) {
    return { date: dhakaDate, total: 0, created: 0 };
  }

  const operations = inventories.map((item) => ({
    updateOne: {
      filter: {
        pharmacyId: item.pharmacyId,
        medicineId: item.medicineId,
        date: dhakaDate,
      },
      update: {
        $setOnInsert: {
          pharmacyId: item.pharmacyId,
          medicineId: item.medicineId,
          date: dhakaDate,
          quantity: item.quantity,
          reorderLevel: item.reorderLevel,
          recordedAt: now,
        },
      },
      upsert: true,
    },
  }));

  const result = await DailyStockSnapshot.bulkWrite(operations, {
    ordered: false,
  });

  return {
    date: dhakaDate,
    total: inventories.length,
    created: result.upsertedCount,
  };
}
