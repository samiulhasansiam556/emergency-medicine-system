import { Request, Response } from "express";
import * as admin from "../services/admin.service";
import { UserRole } from "../models/User";
import { readPaging, readString, sendError } from "../utils/respond";

function readBool(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function overviewController(_req: Request, res: Response) {
  try {
    res.status(200).json({ success: true, data: await admin.getOverview() });
  } catch (e) { sendError(res, e, "Admin overview"); }
}

export async function listUsersController(req: Request, res: Response) {
  try {
    const role = readString(req.query.role);
    if (role && !["USER", "PHARMACY_OWNER", "ADMIN"].includes(role)) {
      res.status(400).json({ success: false, message: "Invalid role." });
      return;
    }
    const result = await admin.listUsers({
      role: role as UserRole | undefined,
      isActive: readBool(req.query.isActive),
      search: readString(req.query.search),
      ...readPaging(req),
    });
    res.status(200).json({ success: true, ...result });
  } catch (e) { sendError(res, e, "List users"); }
}

export async function setUserStatusController(req: Request, res: Response) {
  try {
    const { isActive } = req.body ?? {};
    if (typeof isActive !== "boolean") {
      res.status(400).json({ success: false, message: "isActive (boolean) is required." });
      return;
    }
    const data = await admin.setUserStatus(req.user!.id, req.params.id as string, isActive);
    res.status(200).json({ success: true, data });
  } catch (e) { sendError(res, e, "Set user status"); }
}

export async function listPharmaciesController(req: Request, res: Response) {
  try {
    const result = await admin.listPharmacies({
      isActive: readBool(req.query.isActive),
      search: readString(req.query.search),
      ...readPaging(req),
    });
    res.status(200).json({ success: true, ...result });
  } catch (e) { sendError(res, e, "Admin list pharmacies"); }
}

export async function activatePharmacyController(req: Request, res: Response) {
  try {
    const data = await admin.activatePharmacy(req.params.id as string);
    res.status(200).json({ success: true, message: "Pharmacy activated.", data });
  } catch (e) { sendError(res, e, "Activate pharmacy"); }
}

export async function listMedicinesController(req: Request, res: Response) {
  try {
    const result = await admin.listMedicines({
      isActive: readBool(req.query.isActive),
      search: readString(req.query.search),
      ...readPaging(req),
    });
    res.status(200).json({ success: true, ...result });
  } catch (e) { sendError(res, e, "Admin list medicines"); }
}

export async function activateMedicineController(req: Request, res: Response) {
  try {
    const data = await admin.activateMedicine(req.params.id as string);
    res.status(200).json({ success: true, message: "Medicine activated.", data });
  } catch (e) { sendError(res, e, "Activate medicine"); }
}

export async function riskByMedicineController(req: Request, res: Response) {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    res.status(200).json({ success: true, ...(await admin.riskByMedicine(limit)) });
  } catch (e) { sendError(res, e, "Risk by medicine"); }
}

export async function listModelsController(_req: Request, res: Response) {
  try {
    const data = await admin.listModels();
    res.status(200).json({ success: true, count: data.length, data });
  } catch (e) { sendError(res, e, "List models"); }
}

export async function activeModelController(_req: Request, res: Response) {
  try {
    res.status(200).json({ success: true, data: await admin.getActiveModel() });
  } catch (e) { sendError(res, e, "Active model"); }
}

export async function modelComparisonController(req: Request, res: Response) {
  try {
    const result = await admin.modelComparison(readString(req.query.version, 50));
    res.status(200).json({ success: true, ...result });
  } catch (e) { sendError(res, e, "Model comparison"); }
}