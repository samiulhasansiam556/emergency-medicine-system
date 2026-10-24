import "dotenv/config";
import mongoose from "mongoose";
import Medicine from "../models/Medicine";

async function testMedicine(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    const medicine = await Medicine.create({
      name: "Paracetamol 500 mg",
      genericName: "Paracetamol",
      strength: "500 mg",
      dosageForm: "TABLET",
      manufacturer: "Test Manufacturer",
      category: "Pain Relief",
    });

    console.log("Medicine created:", medicine._id.toString());
    console.log("Medicine name:", medicine.name);
    console.log("Generic name:", medicine.genericName);
    console.log("Collection:", Medicine.collection.name);
  } catch (error) {
    console.error("Medicine test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testMedicine();
