import { Request, Response } from "express";
import mongoose from "mongoose";
import { RISK_LEVELS, getRiskSummary,getRiskHistory, listRisk } from "../services/risk.service";
import { ShortageRiskLevel } from "../models/ShortagePrediction";

function readPharmacyId(req: Request): string | undefined {
  const value = req.query.pharmacyId;
  return typeof value === "string" && mongoose.isValidObjectId(value) ? value : undefined;
}

export async function riskSummaryController(req: Request, res: Response) {
  try {
    const result = await getRiskSummary(readPharmacyId(req));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Risk summary failed:", error);
    res.status(500).json({ success: false, message: "Unable to load risk summary." });
  }
}

export async function riskListController(req: Request, res: Response) {
  try {
    const rawLevel = typeof req.query.level === "string" ? req.query.level : undefined;
    if (rawLevel && !RISK_LEVELS.includes(rawLevel as ShortageRiskLevel)) {
      res.status(400).json({ success: false, message: "Invalid risk level." });
      return;
    }

    const search =
      typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : undefined;

    const result = await listRisk({
      pharmacyId: readPharmacyId(req),
      level: rawLevel as ShortageRiskLevel | undefined,
      search: search || undefined,
      sort: req.query.sort === "days" ? "days" : "risk",
      page: Math.max(1, Number(req.query.page) || 1),
      limit: Math.min(100, Math.max(1, Number(req.query.limit) || 25)),
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Risk list failed:", error);
    res.status(500).json({ success: false, message: "Unable to load risk list." });
  }
}


export async function riskHistoryController(req: Request, res: Response) {
  try {
    const pharmacyId = readPharmacyId(req);
    const medicineId = typeof req.query.medicineId === "string" ? req.query.medicineId : undefined;

    if (!pharmacyId || !medicineId || !mongoose.isValidObjectId(medicineId)) {
      res.status(400).json({ success: false, message: "Valid pharmacyId and medicineId are required." });
      return;
    }

    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const result = await getRiskHistory({ pharmacyId, medicineId, days });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Risk history failed:", error);
    res.status(500).json({ success: false, message: "Unable to load risk history." });
  }
}