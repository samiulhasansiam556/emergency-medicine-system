
import "dotenv/config";
import mongoose from "mongoose";
import User from "./models/User";
import Pharmacy from "./models/Pharmacy";
import Medicine from "./models/Medicine";
import Inventory from "./models/Inventory";

async function testInventory(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    // Find the test pharmacy, medicine and owner.
    const pharmacy = await Pharmacy.findOne({
      name: "Test Medicine Pharmacy",
    });

    const medicine = await Medicine.findOne({
      name: "Paracetamol 500 mg",
    });

    const owner = await User.findOne({
      email: { $regex: /^pharmacy-owner-/ },
    });

    if (!pharmacy || !medicine || !owner) {
      throw new Error(
        "Test pharmacy, medicine or owner not found. Run the earlier tests first."
      );
    }

    // Create inventory only if this pharmacy-medicine pair doesn't exist.
    let inventory = await Inventory.findOne({
      pharmacyId: pharmacy._id,
      medicineId: medicine._id,
    });

    if (!inventory) {
      inventory = await Inventory.create({
        pharmacyId: pharmacy._id,
        medicineId: medicine._id,
        quantity: 100,
        reorderLevel: 20,
        lastUpdatedBy: owner._id,
      });
    }

    console.log("Inventory ID:", inventory._id.toString());
    console.log("Pharmacy:", pharmacy.name);
    console.log("Medicine:", medicine.name);
    console.log("Current stock:", inventory.quantity);
    console.log("Reorder level:", inventory.reorderLevel);
    console.log("Collection:", Inventory.collection.name);
  } catch (error) {
    console.error("Inventory test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testInventory();
