import "dotenv/config";
import mongoose from "mongoose";
import Pharmacy from "./models/Pharmacy";

async function migrateGeo(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);

    const pharmacies = await Pharmacy.find({
      "location.latitude": { $exists: true },
      "location.longitude": { $exists: true },
    });

    let updated = 0;
    for (const p of pharmacies) {
      if (!p.location) continue;
      p.geo = {
        type: "Point",
        coordinates: [p.location.longitude, p.location.latitude],
      };
      await p.save();
      updated++;
    }

    await Pharmacy.syncIndexes();
    console.log(`Migrated ${updated} pharmacies. Indexes synced.`);
  } catch (error) {
    console.error("Geo migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void migrateGeo();