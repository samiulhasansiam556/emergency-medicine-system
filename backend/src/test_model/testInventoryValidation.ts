import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User";
import Pharmacy from "../models/Pharmacy";
import Medicine from "../models/Medicine";
import Inventory from "../models/Inventory";
import { updateStock } from "../services/inventory.service";

async function testInventoryValidation(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);

    const pharmacy = await Pharmacy.findOne({
      name: "Test Medicine Pharmacy",
    });

    const medicine = await Medicine.findOne({
      name: "Paracetamol 500 mg",
    });

    const owner = await User.findOne({
      email: { $regex: /^pharmacy-owner-/ },
      role: "PHARMACY_OWNER",
    });

    if (!pharmacy || !medicine || !owner) {
      throw new Error("Required test records not found.");
    }

    const inventory = await Inventory.findOne({
      pharmacyId: pharmacy._id,
      medicineId: medicine._id,
    });

    if (!inventory) {
      throw new Error("Inventory record not found.");
    }

    const before = inventory.quantity;

    try {
      await updateStock({
        pharmacyId: pharmacy._id.toString(),
        medicineId: medicine._id.toString(),
        userId: owner._id.toString(),
        movementType: "SALE",
        quantityChange: -(before + 1),
      });

      throw new Error("FAIL: Insufficient stock was accepted.");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "FAIL: Insufficient stock was accepted."
      ) {
        throw error;
      }

      console.log("PASS: Insufficient stock was rejected.");
    }

    try {
      await updateStock({
        pharmacyId: pharmacy._id.toString(),
        medicineId: medicine._id.toString(),
        userId: owner._id.toString(),
        movementType: "SALE",
        quantityChange: 0,
      });

      throw new Error("FAIL: Zero quantity was accepted.");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "FAIL: Zero quantity was accepted."
      ) {
        throw error;
      }

      console.log("PASS: Zero quantity was rejected.");
    }

    const after = await Inventory.findOne({
      pharmacyId: pharmacy._id,
      medicineId: medicine._id,
    });

    console.log("Stock before validation tests:", before);
    console.log("Stock after validation tests:", after?.quantity);
    console.log("Stock unchanged:", before === after?.quantity);
  } catch (error) {
    console.error("Validation test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testInventoryValidation();
