import { Request, Response } from "express";
import {
  createMedicine,
  searchMedicines,
  getMedicineById,
  updateMedicine,
  deactivateMedicine,
} from "../services/medicine.service";

function handleError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error.";

  if (message.startsWith("Invalid ")) {
    res.status(400).json({ success: false, message });
  } else if (message === "Medicine not found.") {
    res.status(404).json({ success: false, message });
  } else if (error instanceof Error && error.name === "ValidationError") {
    res.status(400).json({ success: false, message: "Invalid medicine data." });
  } else if ((error as { code?: number }).code === 11000) {
    res.status(409).json({ success: false, message: "This medicine already exists." });
  } else {
    console.error("Medicine API error:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}

const isNonEmpty = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

export async function createMedicineController(req: Request, res: Response) {
  try {
    const { name, genericName, strength, dosageForm, manufacturer, category } = req.body;

    if (
      !isNonEmpty(name) ||
      !isNonEmpty(genericName) ||
      !isNonEmpty(strength) ||
      !isNonEmpty(dosageForm)
    ) {
      res.status(400).json({
        success: false,
        message: "name, genericName, strength, and dosageForm are required.",
      });
      return;
    }

    if (
      (manufacturer !== undefined && typeof manufacturer !== "string") ||
      (category !== undefined && typeof category !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "manufacturer and category must be strings.",
      });
      return;
    }

    const medicine = await createMedicine({
      name: name.trim(),
      genericName: genericName.trim(),
      strength: strength.trim(),
      dosageForm: dosageForm.trim().toUpperCase(),
      manufacturer,
      category,
    });

    res.status(201).json({ success: true, data: medicine });
  } catch (error) {
    handleError(res, error);
  }
}

export async function searchMedicinesController(req: Request, res: Response) {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : undefined;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const result = await searchMedicines({ search, page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getMedicineByIdController(req: Request, res: Response) {
  try {
    const medicine = await getMedicineById(req.params.id as string);
    res.status(200).json({ success: true, data: medicine });
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateMedicineController(req: Request, res: Response) {
  try {
    const medicine = await updateMedicine(req.params.id as string, req.body);
    res.status(200).json({ success: true, data: medicine });
  } catch (error) {
    handleError(res, error);
  }
}

export async function deactivateMedicineController(req: Request, res: Response) {
  try {
    const medicine = await deactivateMedicine(req.params.id as string);
    res.status(200).json({ success: true, message: "Medicine deactivated.", data: medicine });
  } catch (error) {
    handleError(res, error);
  }
}

import { listCategories } from "../services/medicine.service";

export async function listCategoriesController(_req: Request, res: Response) {
  try {
    const data = await listCategories();
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    handleError(res, error);
  }
}