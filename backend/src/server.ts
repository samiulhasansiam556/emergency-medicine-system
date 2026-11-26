
import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDatabase } from "./config/database";
import authRoutes from "./routes/auth.routes";
import pharmacyRoutes from "./routes/pharmacy.routes"
import medicineRoutes from "./routes/medicine.routes";
import inventoryRoutes from "./routes/inventory.routes";
import searchRoutes from "./routes/search.routes";
import riskRoutes from "./routes/risk.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import adminRoutes from "./routes/admin.routes";
import { startDailySnapshotJob } from "./jobs/dailySnapshot.job";
import demandRoutes from "./routes/demand.routes";




const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/pharmacies", pharmacyRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/demand", demandRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);





app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Emergency Medicine API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    startDailySnapshotJob();

    app.listen(PORT, () => {
      console.log(`Backend server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
}

void startServer();
