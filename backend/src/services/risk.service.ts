import mongoose from "mongoose";
import ShortagePrediction, {
  IPredictionFeatures,
  ShortageRiskLevel,
} from "../models/ShortagePrediction";
import ModelRun from "../models/ModelRun";
import Medicine from "../models/Medicine";

export const RISK_LEVELS: ShortageRiskLevel[] = [
  "HIGH",
  "MEDIUM",
  "LOW",
  "INSUFFICIENT_DATA",
];

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------
// Which predictions are "current"?
//   - only the active model's predictions
//   - only the newest day of data (asOfDate)
// ---------------------------------------------------------------
async function getActiveVersion(): Promise<string | null> {
  const run = await ModelRun.findOne({ isActive: true }).select("version").lean();
  if (run) return run.version;

  // Fallback if the model registry has not been written yet.
  const latest = await ShortagePrediction.findOne({ asOfDate: { $exists: true } })
    .sort({ generatedAt: -1 })
    .select("modelVersion")
    .lean();
  return latest?.modelVersion ?? null;
}

async function currentScope(pharmacyId?: string) {
  const version = await getActiveVersion();
  if (!version) return null;

  const match: Record<string, unknown> = { modelVersion: version };
  if (pharmacyId) match.pharmacyId = new mongoose.Types.ObjectId(pharmacyId);

  const newest = await ShortagePrediction.findOne({
    ...match,
    asOfDate: { $exists: true },
  })
    .sort({ asOfDate: -1 })
    .select("asOfDate predictedForDate")
    .lean();

  if (!newest?.asOfDate) return null;

  return {
    version,
    asOfDate: newest.asOfDate,
    predictedForDate: newest.predictedForDate,
    match: { ...match, asOfDate: newest.asOfDate },
  };
}

// ---------------------------------------------------------------
// Plain-language reasons, built from the numbers behind the prediction.
// These describe the main signals; they are not the model's internals.
// ---------------------------------------------------------------
export function buildReasons(f?: IPredictionFeatures): string[] {
  if (!f) return [];
  const reasons: string[] = [];

  if (f.daysOfStockLeft < 1) {
    reasons.push("Stock may run out within a day at the current demand");
  } else if (f.daysOfStockLeft < 3) {
    reasons.push(`Stock covers only about ${f.daysOfStockLeft.toFixed(1)} days of demand`);
  }

  if (f.stockEnd <= f.reorderLevel) {
    reasons.push("Stock is at or below the reorder level");
  }

  if (f.demandTrend >= 1.2) {
    reasons.push(`Recent demand is up ${Math.round((f.demandTrend - 1) * 100)}% on the weekly average`);
  }

  return reasons;
}

// ---------------------------------------------------------------
// Summary: how many items at each risk level
// ---------------------------------------------------------------
export async function getRiskSummary(pharmacyId?: string) {
  const scope = await currentScope(pharmacyId);

  const counts: Record<ShortageRiskLevel, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INSUFFICIENT_DATA: 0,
  };

  if (!scope) {
    return { available: false, counts, total: 0, baselineAlerts: 0 };
  }

  const [byLevel, baselineAlerts, model] = await Promise.all([
    ShortagePrediction.aggregate<{ _id: ShortageRiskLevel; count: number }>([
      { $match: scope.match },
      { $group: { _id: "$riskLevel", count: { $sum: 1 } } },
    ]),
    ShortagePrediction.countDocuments({ ...scope.match, baselineFlag: true }),
    ModelRun.findOne({ version: scope.version })
      .select("version modelName trainedUntil metrics testPeriod")
      .lean(),
  ]);

  for (const row of byLevel) counts[row._id] = row.count;
  const total = RISK_LEVELS.reduce((sum, level) => sum + counts[level], 0);

  return {
    available: true,
    asOfDate: scope.asOfDate,
    predictedForDate: scope.predictedForDate,
    counts,
    total,
    baselineAlerts,
    model: model
      ? {
          version: model.version,
          name: model.modelName,
          trainedUntil: model.trainedUntil,
          metrics: model.metrics,
        }
      : { version: scope.version },
  };
}

// ---------------------------------------------------------------
// List: the risk table
// ---------------------------------------------------------------
interface ListParams {
  pharmacyId?: string;
  level?: ShortageRiskLevel;
  search?: string;
  sort: "risk" | "days";
  page: number;
  limit: number;
}

interface PopulatedMedicine {
  _id: mongoose.Types.ObjectId;
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  category?: string;
}

interface PopulatedPharmacy {
  _id: mongoose.Types.ObjectId;
  name: string;
}

export async function listRisk(params: ListParams) {
  const { pharmacyId, level, search, sort, page, limit } = params;

  const scope = await currentScope(pharmacyId);
  if (!scope) {
    return { available: false, page, limit, total: 0, data: [] };
  }

  const filter: Record<string, unknown> = { ...scope.match };
  if (level) {
    filter.riskLevel = level;
  } else if (sort === "days") {
    // Items without enough data have no "days left" value.
    filter.riskLevel = { $ne: "INSUFFICIENT_DATA" };
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const medicines = await Medicine.find({
      $or: [{ name: regex }, { genericName: regex }],
    })
      .select("_id")
      .limit(200)
      .lean();
    filter.medicineId = { $in: medicines.map((m) => m._id) };
  }

  const order: Record<string, 1 | -1> =
    sort === "days"
      ? { "features.daysOfStockLeft": 1, shortageProbability: -1, _id: 1 }
      : { shortageProbability: -1, "features.daysOfStockLeft": 1, _id: 1 };

  const [rows, total] = await Promise.all([
    ShortagePrediction.find(filter)
      .sort(order)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("medicineId", "name genericName strength dosageForm category")
      .populate("pharmacyId", "name")
      .lean(),
    ShortagePrediction.countDocuments(filter),
  ]);

  const data = rows.map((row) => {
    const medicine = row.medicineId as unknown as PopulatedMedicine | null;
    const pharmacy = row.pharmacyId as unknown as PopulatedPharmacy | null;
    const f = row.features;

    return {
      id: row._id.toString(),
      pharmacy: pharmacy ? { id: pharmacy._id.toString(), name: pharmacy.name } : null,
      medicine: medicine
        ? {
            id: medicine._id.toString(),
            name: medicine.name,
            genericName: medicine.genericName,
            strength: medicine.strength,
            dosageForm: medicine.dosageForm,
            category: medicine.category ?? null,
          }
        : null,
      riskLevel: row.riskLevel,
      probability: row.shortageProbability ?? null,
      baselineFlag: row.baselineFlag ?? null,
      asOfDate: row.asOfDate,
      predictedForDate: row.predictedForDate,
      stockEnd: f?.stockEnd ?? null,
      reorderLevel: f?.reorderLevel ?? null,
      avgDemand7d: f?.avgDemand7d ?? null,
      daysOfStockLeft: f?.daysOfStockLeft ?? null,
      demandTrend: f?.demandTrend ?? null,
      reasons: buildReasons(f),
    };
  });

  return {
    available: true,
    asOfDate: scope.asOfDate,
    predictedForDate: scope.predictedForDate,
    page,
    limit,
    total,
    data,
  };
}