import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "./config/database";
import { createDailyStockSnapshots } from "./services/dailyStockSnapshot.service";

async function test() {
  try {
    await connectDatabase();

    console.log("Starting manual snapshot test...");

    const result = await createDailyStockSnapshots();

    console.log("Snapshot test result:");
    console.log(result);

    console.log("MANUAL SNAPSHOT TEST: PASS");
  } catch (error) {
    console.error("MANUAL SNAPSHOT TEST: FAIL");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void test();