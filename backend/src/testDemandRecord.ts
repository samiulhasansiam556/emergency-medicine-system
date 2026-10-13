
import "dotenv/config";
import mongoose from "mongoose";
import User from "./models/User";
import Pharmacy from "./models/Pharmacy";
import Medicine from "./models/Medicine";
import DemandRecord from "./models/DemandRecord";

async function testDemandRecord(): Promise<void> {
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
      throw new Error(
        "Test pharmacy, medicine, or pharmacy owner not found."
      );
    }

    const requestedQuantity = 50;
    const fulfilledQuantity = 35;

    const record = await DemandRecord.create({
      pharmacyId: pharmacy._id,
      medicineId: medicine._id,
      requestedQuantity,
      fulfilledQuantity,
      unmetQuantity: requestedQuantity - fulfilledQuantity,
      recordedBy: owner._id,
      source: "PHARMACY",
    });

    console.log("Demand record created successfully!");
    console.log("Record ID:", record._id.toString());
    console.log("Requested:", record.requestedQuantity);
    console.log("Fulfilled:", record.fulfilledQuantity);
    console.log("Unmet:", record.unmetQuantity);
    console.log("Collection:", DemandRecord.collection.name);
  } catch (error) {
    console.error("Demand record test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testDemandRecord();
