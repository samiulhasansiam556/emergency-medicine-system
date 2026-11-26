
import { Request, Response } from "express";
import {
  createDemandRecord,
  listDemandRecords,
} from "../services/demandRecord.service";

function handleError(res: Response, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unexpected error.";

  if (message.startsWith("Invalid ")) {
    res.status(400).json({ success: false, message });
  } else if (message.endsWith("not found.")) {
    res.status(404).json({ success: false, message });
  } else if (
    error instanceof Error &&
    error.name === "ValidationError"
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid demand record data.",
    });
  } else {
    console.error("Demand API error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

export async function createDemandRecordController(
  req: Request,
  res: Response
) {
  try {
    const {
      pharmacyId,
      medicineId,
      requestedQuantity,
      fulfilledQuantity,
    } = req.body ?? {};

    if (
      typeof pharmacyId !== "string" ||
      typeof medicineId !== "string" ||
      typeof requestedQuantity !== "number" ||
      typeof fulfilledQuantity !== "number"
    ) {
      res.status(400).json({
        success: false,
        message:
          "pharmacyId, medicineId, requestedQuantity, and fulfilledQuantity are required.",
      });
      return;
    }

    const data = await createDemandRecord({
      pharmacyId,
      medicineId,
      requestedQuantity,
      fulfilledQuantity,
      userId: req.user!.id,
    });

    res.status(201).json({
      success: true,
      message: "Demand record created successfully.",
      data,
    });
  } catch (error) {
    handleError(res, error);
  }
}

export async function listDemandRecordsController(
  req: Request,
  res: Response
) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination parameters.",
      });
      return;
    }

    const data = await listDemandRecords(
      req.params.id as string,
      page,
      limit
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    handleError(res, error);
  }
}
