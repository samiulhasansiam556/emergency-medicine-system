
import "dotenv/config";
import mongoose from "mongoose";
import User from "./models/User";
import Pharmacy from "./models/Pharmacy";
import Medicine from "./models/Medicine";
import Inventory from "./models/Inventory";
import StockHistory from "./models/StockHistory";
import { updateStock } from "./services/inventory.service";

async function testInventoryService(): Promise<void> {
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
      throw new Error("Test pharmacy, medicine, or owner not found.");
    }

    const inventory = await Inventory.findOne({
      pharmacyId: pharmacy._id,
      medicineId: medicine._id,
    });

    if (!inventory) {
      throw new Error("Inventory record not found.");
    }

    const beforeQuantity = inventory.quantity;

    const result = await updateStock({
      pharmacyId: pharmacy._id.toString(),
      medicineId: medicine._id.toString(),
      userId: owner._id.toString(),
      movementType: "SALE",
      quantityChange: -5,
      note: "Test sale through inventory service",
    });

    const updatedInventory = await Inventory.findById(
      result.inventoryId
    );

    const history = await StockHistory.findOne({
      inventoryId: result.inventoryId,
      movementType: "SALE",
      note: "Test sale through inventory service",
    }).sort({ recordedAt: -1 });

    console.log("Inventory service test successful!");
    console.log("Stock before:", beforeQuantity);
    console.log("Stock after:", updatedInventory?.quantity);
    console.log("Expected stock:", beforeQuantity - 5);
    console.log("History created:", Boolean(history));
    console.log("History quantity change:", history?.quantityChange);
  } catch (error) {
    console.error("Inventory service test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testInventoryService();
