import { Request, Response } from "express";
import { getOwnerDashboard } from "../services/dashboard.service";
import { sendError } from "../utils/respond";

export async function ownerDashboardController(req: Request, res: Response) {
  try {
    const data = await getOwnerDashboard(req.query.pharmacyId as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    sendError(res, error, "Owner dashboard");
  }
}