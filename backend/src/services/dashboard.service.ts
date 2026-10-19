import mongoose from "mongoose";
import Inventory from "../models/Inventory";
import Pharmacy from "../models/Pharmacy";
import { getRiskSummary, listRisk } from "./risk.service";
import { STALE_HOURS } from "./inventoryRecord.service";

export async function getOwnerDashboard(pharmacyId: string) {
  if (!mongoose.isValidObjectId(pharmacyId)) throw new Error("Invalid pharmacy ID.");

  const pharmacy = await Pharmacy.findOne({ _id: pharmacyId, isActive: true }).select("name address").lean();
  if (!pharmacy) throw new Error("Pharmacy not found.");

  const staleBefore = new Date(Date.now() - STALE_HOURS * 3600 * 1000);

  const [stockRows, risk, topRisks] = await Promise.all([
    Inventory.aggregate<{
      totalItems: number; outOfStock: number; low: number; stale: number;
      totalUnits: number; lastUpdate: Date;
    }>([
      { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId) } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalUnits: { $sum: "$quantity" },
          lastUpdate: { $max: "$lastStockUpdatedAt" },
          outOfStock: { $sum: { $cond: [{ $lte: ["$quantity", 0] }, 1, 0] } },
          low: {
            $sum: {
              $cond: [{ $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", "$reorderLevel"] }] }, 1, 0],
            },
          },
          stale: { $sum: { $cond: [{ $lt: ["$lastStockUpdatedAt", staleBefore] }, 1, 0] } },
        },
      },
    ]),
    getRiskSummary(pharmacyId),
    listRisk({ pharmacyId, level: "HIGH", sort: "risk", page: 1, limit: 5 }),
  ]);

  const s = stockRows[0] ?? { totalItems: 0, outOfStock: 0, low: 0, stale: 0, totalUnits: 0, lastUpdate: null };

  return {
    pharmacy: { id: pharmacyId, name: pharmacy.name, address: pharmacy.address },
    inventory: {
      totalItems: s.totalItems,
      available: s.totalItems - s.low - s.outOfStock,
      low: s.low,
      outOfStock: s.outOfStock,
      stale: s.stale,
      totalUnits: s.totalUnits,
      lastStockUpdateAt: s.lastUpdate,
    },
    risk: {
      available: risk.available,
      asOfDate: "asOfDate" in risk ? risk.asOfDate : null,
      predictedForDate: "predictedForDate" in risk ? risk.predictedForDate : null,
      counts: risk.counts,
      baselineAlerts: risk.baselineAlerts,
    },
    topRisks: topRisks.data,
  };
}