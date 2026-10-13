
import "dotenv/config";
import mongoose from "mongoose";
import Pharmacy from "./models/Pharmacy";
import Medicine from "./models/Medicine";
import ShortagePrediction from "./models/ShortagePrediction";

async function testShortagePrediction(): Promise<void> {
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

    const prediction = await ShortagePrediction.create({
      pharmacyId: pharmacy._id,
      medicineId: medicine._id,
      riskLevel: "MEDIUM",
      shortageProbability: 0.65,
      predictionDays: 3,
      predictedForDate: new Date(),
      modelName: "TEST_MODEL",
      modelVersion: "0.1.0",
    });

    console.log("Shortage prediction saved successfully!");
    console.log("Prediction ID:", prediction._id.toString());
    console.log("Risk level:", prediction.riskLevel);
    console.log("Probability:", prediction.shortageProbability);
    console.log("Prediction days:", prediction.predictionDays);
    console.log("Collection:", ShortagePrediction.collection.name);
  } catch (error) {
    console.error("Shortage prediction test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testShortagePrediction();
