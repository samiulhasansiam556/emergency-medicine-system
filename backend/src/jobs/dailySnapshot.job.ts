
import cron from "node-cron";
import { createDailyStockSnapshots } from "../services/dailyStockSnapshot.service";

export function startDailySnapshotJob(): void {
  cron.schedule(
    "55 23 * * *",
    async () => {
      try {
        const result = await createDailyStockSnapshots();
        console.log("[Daily Snapshot]", result);
      } catch (error) {
        console.error("[Daily Snapshot] Failed:", error);
      }
    },
    {
      timezone: "Asia/Dhaka",
    }
  );

  console.log("Daily snapshot scheduler started (11:55 PM Asia/Dhaka)");
}
