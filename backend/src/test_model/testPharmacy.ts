import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User";
import Pharmacy from "../models/Pharmacy";

async function testPharmacy(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    // Create a test owner
    const owner = await User.create({
      name: "Test Pharmacy Owner",
      email: `pharmacy-owner-${Date.now()}@example.com`,
      passwordHash: "TEST_ONLY_NOT_A_REAL_PASSWORD_HASH",
      role: "PHARMACY_OWNER",
    });

    // Create a test pharmacy
    const pharmacy = await Pharmacy.create({
      name: "Test Medicine Pharmacy",
      ownerId: owner._id,
      address: "Mirpur, Dhaka",
      city: "Dhaka",
      phone: "01700000000",
      imageUrl: "",
    });

    console.log("Pharmacy created:", pharmacy._id.toString());
    console.log("Pharmacy name:", pharmacy.name);
    console.log("Owner ID:", pharmacy.ownerId.toString());
    console.log("Collection:", Pharmacy.collection.name);
  } catch (error) {
    console.error("Pharmacy test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testPharmacy();
