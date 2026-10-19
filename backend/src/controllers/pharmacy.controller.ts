import { Request, Response } from "express";
import {
  createPharmacy,
  getAllPharmacies,
  getPharmacyById,
  updatePharmacy,
  deactivatePharmacy,
  getMyPharmacies,
  getNearbyPharmacies
} from "../services/pharmacy.service";

function handleError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error.";

  if (message.startsWith("Invalid ")) {
    res.status(400).json({ success: false, message });
  } else if (message === "Pharmacy not found.") {
    res.status(404).json({ success: false, message });
  } else if (
    error instanceof Error &&
    error.name === "ValidationError"
  ) {
    res.status(400).json({ success: false, message: "Invalid pharmacy data." });
  } else {
    console.error("Pharmacy API error:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}

export async function createPharmacyController(req: Request, res: Response) {
  try {
    const { name, address, city, phone, imageUrl, latitude, longitude } = req.body;
    const ownerId = req.user!.role === "ADMIN" && typeof req.body.ownerId === "string"
    ? req.body.ownerId : req.user!.id;
    if (
      typeof name !== "string" || !name.trim() ||
      typeof address !== "string" || !address.trim() ||
      typeof city !== "string" || !city.trim() ||
      typeof phone !== "string" || !phone.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "name, address, city, and phone are required.",
      });
      return;
    }

    if (
      (latitude !== undefined && typeof latitude !== "number") ||
      (longitude !== undefined && typeof longitude !== "number")
    ) {
      res.status(400).json({
        success: false,
        message: "latitude and longitude must be numbers.",
      });
      return;
    }

    const pharmacy = await createPharmacy({
      name: name.trim(), ownerId, address: address.trim(),
      city: city.trim(), phone: phone.trim(), imageUrl,
      latitude, longitude,
    });

    res.status(201).json({ success: true, data: pharmacy });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getAllPharmaciesController(_req: Request, res: Response) {
  try {
    const pharmacies = await getAllPharmacies();
    res.status(200).json({ success: true, count: pharmacies.length, data: pharmacies });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPharmacyByIdController(req: Request, res: Response) {
  try {
    const pharmacy = await getPharmacyById(req.params.id as string);
    res.status(200).json({ success: true, data: pharmacy });
  } catch (error) {
    handleError(res, error);
  }
}

export async function updatePharmacyController(req: Request, res: Response) {
  try {
    const pharmacy = await updatePharmacy(req.params.id as string, req.body);
    res.status(200).json({ success: true, data: pharmacy });
  } catch (error) {
    handleError(res, error);
  }
}

export async function deactivatePharmacyController(req: Request, res: Response) {
  try {
    const pharmacy = await deactivatePharmacy(req.params.id as string);
    res.status(200).json({ success: true, message: "Pharmacy deactivated.", data: pharmacy });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getMyPharmaciesController(req: Request, res: Response) {
  try {
    const pharmacies = await getMyPharmacies(req.user!.id, req.user!.role);
    res.status(200).json({ success: true, count: pharmacies.length, data: pharmacies });
  } catch (error) {
    handleError(res, error);
  }
}

export async function nearbyPharmaciesController(req: Request, res: Response) {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);

    if (
      req.query.lat === undefined || req.query.lng === undefined ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) {
      res.status(400).json({ success: false, message: "Valid lat and lng are required." });
      return;
    }

    const radiusKm = Math.min(50, Math.max(0.5, Number(req.query.radiusKm) || 5));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const data = await getNearbyPharmacies({ latitude, longitude, radiusKm, limit });
    res.status(200).json({ success: true, radiusKm, count: data.length, data });
  } catch (error) {
    handleError(res, error);
  }
}