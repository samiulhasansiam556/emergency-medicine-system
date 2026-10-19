import mongoose from "mongoose";
import User, { UserRole } from "../models/User";
import Pharmacy from "../models/Pharmacy";
import Medicine from "../models/Medicine";
import Inventory from "../models/Inventory";
import ModelRun from "../models/ModelRun";
import ShortagePrediction from "../models/ShortagePrediction";
import { currentScope, getActiveVersion, getRiskSummary } from "./risk.service";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertId(id: string, label: string) {
  if (!mongoose.isValidObjectId(id)) throw new Error(`Invalid ${label} ID.`);
}

// ---------------------------------------------------------------
// Overview
// ---------------------------------------------------------------
export async function getOverview() {
  const [usersByRole, pharmaciesByStatus, medicines, inventoryItems, risk, model] = await Promise.all([
    User.aggregate<{ _id: UserRole; count: number }>([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Pharmacy.aggregate<{ _id: boolean; count: number }>([{ $group: { _id: "$isActive", count: { $sum: 1 } } }]),
    Medicine.countDocuments({ isActive: true }),
    Inventory.countDocuments(),
    getRiskSummary(),
    ModelRun.findOne({ isActive: true }).lean(),
  ]);

  const users = { USER: 0, PHARMACY_OWNER: 0, ADMIN: 0 } as Record<UserRole, number>;
  for (const r of usersByRole) users[r._id] = r.count;

  return {
    users: { ...users, total: users.USER + users.PHARMACY_OWNER + users.ADMIN },
    pharmacies: {
      active: pharmaciesByStatus.find((p) => p._id === true)?.count ?? 0,
      inactive: pharmaciesByStatus.find((p) => p._id === false)?.count ?? 0,
    },
    medicines,
    inventoryItems,
    risk: {
      available: risk.available,
      asOfDate: "asOfDate" in risk ? risk.asOfDate : null,
      counts: risk.counts,
      baselineAlerts: risk.baselineAlerts,
    },
    activeModel: model
      ? { version: model.version, name: model.modelName, trainedUntil: model.trainedUntil, metrics: model.metrics }
      : null,
  };
}

// ---------------------------------------------------------------
// Users
// ---------------------------------------------------------------
export async function listUsers(params: {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
}) {
  const { role, isActive, search, page, limit } = params;
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive;
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [data, total] = await Promise.all([
    User.find(filter).select("-__v").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { data, total, page, limit };
}

export async function setUserStatus(adminId: string, userId: string, isActive: boolean) {
  assertId(userId, "user");
  if (adminId === userId && !isActive) {
    throw new Error("Invalid request. You cannot deactivate your own account.");
  }

  const user = await User.findByIdAndUpdate(userId, { $set: { isActive } }, { new: true }).select("-__v");
  if (!user) throw new Error("User not found.");
  return user;
}

// ---------------------------------------------------------------
// Pharmacies (includes inactive ones, which the public list hides)
// ---------------------------------------------------------------
export async function listPharmacies(params: {
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
}) {
  const { isActive, search, page, limit } = params;
  const filter: Record<string, unknown> = {};
  if (isActive !== undefined) filter.isActive = isActive;
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { city: regex }, { address: regex }];
  }

  const [rows, total] = await Promise.all([
    Pharmacy.find(filter)
      .select("-__v")
      .populate("ownerId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Pharmacy.countDocuments(filter),
  ]);

  const counts = await Inventory.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { pharmacyId: { $in: rows.map((p) => p._id) } } },
    { $group: { _id: "$pharmacyId", count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [c._id.toString(), c.count]));

  const data = rows.map((p) => ({ ...p, inventoryCount: countById.get(p._id.toString()) ?? 0 }));
  return { data, total, page, limit };
}

export async function activatePharmacy(id: string) {
  assertId(id, "pharmacy");
  const pharmacy = await Pharmacy.findOneAndUpdate(
    { _id: id, isActive: false },
    { $set: { isActive: true } },
    { new: true }
  ).select("-__v");
  if (!pharmacy) throw new Error("Inactive pharmacy not found.");
  return pharmacy;
}

// ---------------------------------------------------------------
// Medicines (includes inactive ones)
// ---------------------------------------------------------------
export async function listMedicines(params: {
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
}) {
  const { isActive, search, page, limit } = params;
  const filter: Record<string, unknown> = {};
  if (isActive !== undefined) filter.isActive = isActive;
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { genericName: regex }];
  }

  const [data, total] = await Promise.all([
    Medicine.find(filter).select("-__v").sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Medicine.countDocuments(filter),
  ]);
  return { data, total, page, limit };
}

export async function activateMedicine(id: string) {
  assertId(id, "medicine");
  const medicine = await Medicine.findOneAndUpdate(
    { _id: id, isActive: false },
    { $set: { isActive: true } },
    { new: true }
  ).select("-__v");
  if (!medicine) throw new Error("Inactive medicine not found.");
  return medicine;
}

// ---------------------------------------------------------------
// City-wide risk, grouped by medicine
// ---------------------------------------------------------------
export async function riskByMedicine(limit: number) {
  const scope = await currentScope();
  if (!scope) return { available: false, data: [] };

  const count = (level: string) => ({ $sum: { $cond: [{ $eq: ["$riskLevel", level] }, 1, 0] } });

  const rows = await ShortagePrediction.aggregate([
    { $match: scope.match },
    {
      $group: {
        _id: "$medicineId",
        pharmacies: { $sum: 1 },
        high: count("HIGH"),
        medium: count("MEDIUM"),
        low: count("LOW"),
        insufficientData: count("INSUFFICIENT_DATA"),
        avgProbability: { $avg: "$shortageProbability" },
      },
    },
    { $sort: { high: -1, medium: -1, avgProbability: -1 } },
    { $limit: limit },
    { $lookup: { from: "medicines", localField: "_id", foreignField: "_id", as: "medicine" } },
    { $unwind: "$medicine" },
    {
      $project: {
        _id: 0,
        medicine: {
          id: "$medicine._id",
          name: "$medicine.name",
          genericName: "$medicine.genericName",
          strength: "$medicine.strength",
          category: "$medicine.category",
        },
        pharmacies: 1, high: 1, medium: 1, low: 1, insufficientData: 1, avgProbability: 1,
      },
    },
  ]);

  const data = rows.map((r) => ({
    ...r,
    avgProbability: r.avgProbability === null ? null : Math.round(r.avgProbability * 1000) / 1000,
    highShare: r.pharmacies ? Math.round((r.high / r.pharmacies) * 1000) / 1000 : 0,
  }));

  return { available: true, asOfDate: scope.asOfDate, predictedForDate: scope.predictedForDate, data };
}

// ---------------------------------------------------------------
// ML models
// ---------------------------------------------------------------
export async function listModels() {
  return ModelRun.find().select("-__v").sort({ createdAt: -1 }).lean();
}

export async function getActiveModel() {
  const run = await ModelRun.findOne({ isActive: true }).select("-__v").lean();
  if (!run) throw new Error("Active model not found.");
  return run;
}

function flagScore(
  rows: { _id: { ml: boolean; mlMed: boolean; base: boolean; actual: boolean }; count: number }[],
  pick: (id: { ml: boolean; mlMed: boolean; base: boolean }) => boolean
) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    const predicted = pick(r._id);
    if (predicted && r._id.actual) tp += r.count;
    else if (predicted) fp += r.count;
    else if (r._id.actual) fn += r.count;
    else tn += r.count;
  }
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const total = tp + fp + fn + tn;

  return {
    precision: round(precision), recall: round(recall), f1: round(f1),
    alertRate: total ? round((tp + fp) / total) : 0,
    tp, fp, fn, tn,
  };
}

// ML vs "stock <= reorder level" rule, on predictions whose 3 days have already passed.
// Needs evaluate_live.py to have written actualStockout onto the predictions.
export async function modelComparison(version?: string) {
  const v = version ?? (await getActiveVersion());
  if (!v) throw new Error("Model not found.");

  const base = { modelVersion: v, actualStockout: { $type: "bool" }, riskLevel: { $ne: "INSUFFICIENT_DATA" } };

  const [run, rows, byLevel] = await Promise.all([
    ModelRun.findOne({ version: v }).select("version modelName trainedUntil metrics testPeriod").lean(),
    ShortagePrediction.aggregate([
      { $match: base },
      {
        $group: {
          _id: {
            ml: { $eq: ["$riskLevel", "HIGH"] },
            mlMed: { $in: ["$riskLevel", ["MEDIUM", "HIGH"]] },
            base: { $eq: ["$baselineFlag", true] },
            actual: "$actualStockout",
          },
          count: { $sum: 1 },
        },
      },
    ]),
    ShortagePrediction.aggregate<{ _id: string; count: number; shortages: number }>([
      { $match: base },
      { $group: { _id: "$riskLevel", count: { $sum: 1 }, shortages: { $sum: { $cond: ["$actualStockout", 1, 0] } } } },
    ]),
  ]);

  const checked = rows.reduce((sum, r) => sum + r.count, 0);
  if (checked === 0) {
    return {
      available: false,
      version: v,
      message: "No evaluated predictions yet. Run evaluate_live.py after the prediction days have passed.",
    };
  }

  const actualShortages = rows.filter((r) => r._id.actual).reduce((s, r) => s + r.count, 0);

  return {
    available: true,
    version: v,
    model: run,
    predictionsChecked: checked,
    actualShortageRate: Math.round((actualShortages / checked) * 10000) / 10000,
    mlHigh: flagScore(rows, (id) => id.ml),
    mlMediumPlus: flagScore(rows, (id) => id.mlMed),
    thresholdBaseline: flagScore(rows, (id) => id.base),
    byRiskLevel: Object.fromEntries(
      byLevel.map((l) => [
        l._id,
        { count: l.count, shortageRate: Math.round((l.shortages / l.count) * 10000) / 10000 },
      ])
    ),
  };
}