import { Request, Response } from "express";
import { searchNearbyAvailability } from "../services/search.service";

export async function searchMedicineController(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const medicineId =
      typeof req.query.medicineId === "string"
        ? req.query.medicineId
        : undefined;

    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);

    if (!q && !medicineId) {
      res
        .status(400)
        .json({
          success: false,
          message: "Provide q (medicine name) or medicineId.",
        });
      return;
    }

    if (
      req.query.lat === undefined ||
      req.query.lng === undefined ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      res
        .status(400)
        .json({ success: false, message: "Valid lat and lng are required." });
      return;
    }

    const radiusKm = Math.min(
      50,
      Math.max(0.5, Number(req.query.radiusKm) || 5),
    );

    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const sort = req.query.sort === "freshness" ? "freshness" : "distance";

    const result = await searchNearbyAvailability({
      q,
      medicineId,
      latitude,
      longitude,
      radiusKm,
      limit,
      sort,
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Invalid ")) {
      res.status(400).json({ success: false, message });
      return;
    }
    console.error("Search failed:", error);
    res.status(500).json({ success: false, message: "Unable to search." });
  }
}
