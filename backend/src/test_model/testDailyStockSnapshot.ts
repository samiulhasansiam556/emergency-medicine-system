import "dotenv/config";
import mongoose from "mongoose";
import Pharmacy from "../models/Pharmacy";
import Medicine from "../models/Medicine";
import Inventory from "../models/Inventory";
import DailyStockSnapshot from "../models/DailyStockSnapshot";

async function testDailyStockSnapshot(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);

    const pharmacy = await Pharmacy.findOne({
      name: "Test Medicine Pharmacy",
    });

    const medicine = await Medicine.findOne({
      name: "Paracetamol 500 mg",
    });

    if (!pharmacy || !medicine) {
      throw new Error("Test pharmacy or medicine not found.");
    }

    const inventory = await Inventory.findOne({
      pharmacyId: pharmacy._id,
      medicineId: medicine._id,
    });

    if (!inventory) {
      throw new Error("Inventory record not found.");
    }

    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const snapshot = await DailyStockSnapshot.findOneAndUpdate(
      {
        pharmacyId: pharmacy._id,
        medicineId: medicine._id,
        date: today,
      },
      {
        $set: {
          quantity: inventory.quantity,
          reorderLevel: inventory.reorderLevel,
          recordedAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    console.log("Daily stock snapshot saved successfully!");
    console.log("Snapshot ID:", snapshot._id.toString());
    console.log("Quantity:", snapshot.quantity);
    console.log("Reorder level:", snapshot.reorderLevel);
    console.log("Collection:", DailyStockSnapshot.collection.name);
  } catch (error) {
    console.error("Daily stock snapshot test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testDailyStockSnapshot();
