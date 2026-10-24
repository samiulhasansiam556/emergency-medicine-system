import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User";

async function testDatabase(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    const testEmail = `db-check-${Date.now()}@example.com`;

    const user = await User.create({
      name: "Database Test User",
      email: testEmail,
      passwordHash: "TEST_ONLY_NOT_A_REAL_PASSWORD_HASH",
      role: "USER",
    });

    console.log("Test document inserted:", user._id.toString());
    console.log("Collection:", User.collection.name);
    console.log("Test email:", user.email);
  } catch (error) {
    console.error("Database test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void testDatabase();
