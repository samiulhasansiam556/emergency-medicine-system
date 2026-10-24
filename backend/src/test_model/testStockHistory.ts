import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User";
import Pharmacy from "../models/Pharmacy";
import Medicine from "../models/Medicine";
import Inventory from "../models/Inventory";
import StockHistory from "../models/StockHistory";

async function testStockHistory(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    const pharmacy = await Pharmacy.findOne({
      name: "Test Medicine Pharmacy",
    });

    const medicine = await Medicine.findOne({
      name: "Paracetamol 500 mg",
    });

    const inventory =
      pharmacy && medicine
        ? await Inventory.findOne({
            pharmacyId: pharmacy._id,
            medicineId: medicine._id,
          })
        : null;

    const owner = await User.findOne({
      email: { $regex: /^pharmacy-owner-/ },
    });

    if (!pharmacy || !medicine || !inventory || !owner) {
      throw new Error("Test pharmacy, medicine, inventory or owner not found");
    }

    const history = await StockHistory.create({
      pharmacyId: pharmacy._id,
      medicineId: medicine._id,
      inventoryId: inventory._id,
      movementType: "INITIAL_STOCK",
      quantityChange: inventory.quantity,
      quantityAfter: inventory.quantity,
      recordedBy: owner._id,
      note: "Initial stock history test record",
    });

    console.log("Stock history created:", history._id.toString());
    console.log("Movement type:", history.movementType);
    console.log("Quantity change:", history.quantityChange);
    console.log("Quantity after:", history.quantityAfter);
    console.log("Collection:", StockHistory.collection.name);
  } catch (error) {
    console.error("Stock history test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testStockHistory();
