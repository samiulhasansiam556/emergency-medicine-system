import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { verifyToken } from "../services/auth.service";
import { UserRole } from "../models/User";
import Pharmacy from "../models/Pharmacy";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return;
  }

  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: "You do not have permission." });
      return;
    }
    next();
  };
}

// Pharmacy owners may only touch their own pharmacy. Admins may touch any.
// Reads the pharmacy id from req.params.id, req.body.pharmacyId or ?pharmacyId=
export async function requirePharmacyAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const fromQuery =
    typeof req.query?.pharmacyId === "string" ? req.query.pharmacyId : undefined;
  const pharmacyId = (req.params.id ?? req.body?.pharmacyId ?? fromQuery) as
    | string
    | undefined;

  if (!pharmacyId || !mongoose.isValidObjectId(pharmacyId)) {
    res.status(400).json({ success: false, message: "Valid pharmacy ID is required." });
    return;
  }

  if (req.user?.role === "ADMIN") {
    next();
    return;
  }

  const pharmacy = await Pharmacy.findOne({ _id: pharmacyId, isActive: true }).select("ownerId");

  if (!pharmacy) {
    res.status(404).json({ success: false, message: "Pharmacy not found." });
    return;
  }

  if (pharmacy.ownerId.toString() !== req.user?.id) {
    res.status(403).json({ success: false, message: "This is not your pharmacy." });
    return;
  }

  next();
}

// For read-only list endpoints that take ?pharmacyId=
//   - admin: pharmacyId is optional (no id = all pharmacies)
//   - owner: pharmacyId is required and must be their own pharmacy
export async function requirePharmacyScope(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const raw = req.query.pharmacyId;
  const pharmacyId = typeof raw === "string" && raw ? raw : undefined;

  if (req.user?.role === "ADMIN") {
    if (pharmacyId && !mongoose.isValidObjectId(pharmacyId)) {
      res.status(400).json({ success: false, message: "Valid pharmacy ID is required." });
      return;
    }
    next();
    return;
  }

  if (!pharmacyId) {
    res.status(400).json({ success: false, message: "pharmacyId is required." });
    return;
  }

  await requirePharmacyAccess(req, res, next);
}