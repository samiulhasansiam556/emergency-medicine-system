/**
 * Seeds MongoDB with a realistic demo dataset:
 *   users (1 admin, 1 owner per pharmacy, normal users), pharmacies, medicines,
 *   inventory, stock history, daily snapshots and demand records.
 *
 * The data comes from the CSV files made by ml-service/src/generate_data.py.
 *
 * Usage (from backend/):
 *   npx tsx src/seed/seedData.ts
 *   npx tsx src/seed/seedData.ts --reset
 *   npx tsx src/seed/seedData.ts --reset --record-rate 0.8 --users 30
 *
 * --reset only removes data created by this script (users with the
 * @seed.medfinder.test email and everything that belongs to their pharmacies).
 * Your own manually created data is never touched.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User";
import Pharmacy from "../models/Pharmacy";
import Medicine from "../models/Medicine";
import Inventory from "../models/Inventory";
import StockHistory from "../models/StockHistory";
import DailyStockSnapshot from "../models/DailyStockSnapshot";
import DemandRecord from "../models/DemandRecord";
import ShortagePrediction from "../models/ShortagePrediction";

const SEED_EMAIL_DOMAIN = "@seed.medfinder.test";
const DEMO_PASSWORD = "Password123!";

// ---------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------
function getArg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

// Deterministic random numbers, so the same seed gives the same database.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Row = Record<string, string>;

function readCsv(file: string): Row[] {
  const text = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const header = text[0].split(",");
  return text.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Row = {};
    header.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
}

// "2026-10-04" + minutes since midnight (UTC) -> Date
function at(date: string, minutesUtc: number): Date {
  const hh = String(Math.floor(minutesUtc / 60)).padStart(2, "0");
  const mm = String(minutesUtc % 60).padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00.000Z`);
}

// Split a number into k positive whole parts that add up to the total.
function splitInto(total: number, k: number, rand: () => number): number[] {
  const parts = new Array<number>(k).fill(1);
  let remaining = total - k;
  const weights = parts.map(() => rand() + 0.2);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < k - 1; i++) {
    const add = Math.floor((remaining * weights[i]) / weightSum);
    parts[i] += add;
  }
  const used = parts.reduce((a, b) => a + b, 0);
  parts[k - 1] += total - used;
  return parts;
}

async function insertInBatches<T>(
  label: string,
  docs: T[],
  insert: (batch: T[]) => Promise<unknown>,
  size = 5000
): Promise<void> {
  for (let i = 0; i < docs.length; i += size) {
    await insert(docs.slice(i, i + size));
  }
  console.log(`  ${label}: ${docs.length.toLocaleString()}`);
}

// ---------------------------------------------------------------
// Reset: remove only seeded data
// ---------------------------------------------------------------
async function resetSeededData(): Promise<void> {
  const seededUsers = await User.find({
    email: { $regex: `${SEED_EMAIL_DOMAIN.replace(".", "\\.")}$` },
  })
    .select("_id")
    .lean();

  const userIds = seededUsers.map((u) => u._id);
  const pharmacies = await Pharmacy.find({ ownerId: { $in: userIds } })
    .select("_id")
    .lean();
  const pharmacyIds = pharmacies.map((p) => p._id);

  await Promise.all([
    StockHistory.deleteMany({ pharmacyId: { $in: pharmacyIds } }),
    DailyStockSnapshot.deleteMany({ pharmacyId: { $in: pharmacyIds } }),
    DemandRecord.deleteMany({ pharmacyId: { $in: pharmacyIds } }),
    ShortagePrediction.deleteMany({ pharmacyId: { $in: pharmacyIds } }),
    Inventory.deleteMany({ pharmacyId: { $in: pharmacyIds } }),
  ]);
  await Pharmacy.deleteMany({ _id: { $in: pharmacyIds } });
  await User.deleteMany({ _id: { $in: userIds } });

  console.log(
    `Reset done: removed ${userIds.length} seeded users and ${pharmacyIds.length} seeded pharmacies (with their data).`
  );
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is missing");

  const dataDir = path.resolve(
    process.cwd(),
    getArg("data", "../ml-service/data/raw")
  );
  const recordRate = Math.min(1, Math.max(0, Number(getArg("record-rate", "0.8"))));
  const normalUsers = Math.max(0, Number(getArg("users", "30")));
  const rand = mulberry32(Number(getArg("seed", "42")));

  for (const f of ["inventory_daily.csv", "pharmacies.csv", "medicines.csv"]) {
    if (!fs.existsSync(path.join(dataDir, f))) {
      throw new Error(
        `Missing ${f} in ${dataDir}. Run: python src/generate_data.py --pharmacies 10 --medicines 20 --days 120`
      );
    }
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log("MongoDB connected");

  if (hasFlag("reset")) {
    await resetSeededData();
  } else {
    const existing = await User.exists({ email: `admin${SEED_EMAIL_DOMAIN}` });
    if (existing) {
      throw new Error("Seed data already exists. Run again with --reset to rebuild it.");
    }
  }

  const pharmacyRows = readCsv(path.join(dataDir, "pharmacies.csv"));
  const medicineRows = readCsv(path.join(dataDir, "medicines.csv"));
  const dailyRows = readCsv(path.join(dataDir, "inventory_daily.csv"));

  // ---------- Users ----------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await User.create({
    name: "Demo Admin",
    email: `admin${SEED_EMAIL_DOMAIN}`,
    passwordHash,
    role: "ADMIN",
  });

  const owners = await User.insertMany(
    pharmacyRows.map((p, i) => ({
      name: `Owner of ${p.name}`,
      email: `owner${i + 1}${SEED_EMAIL_DOMAIN}`,
      passwordHash,
      role: "PHARMACY_OWNER" as const,
    }))
  );

  if (normalUsers > 0) {
    await User.insertMany(
      Array.from({ length: normalUsers }, (_, i) => ({
        name: `Demo User ${i + 1}`,
        email: `user${i + 1}${SEED_EMAIL_DOMAIN}`,
        passwordHash,
        role: "USER" as const,
      }))
    );
  }

  // ---------- Pharmacies ----------
  const pharmacyDocs = await Pharmacy.insertMany(
    pharmacyRows.map((p, i) => {
      const latitude = Number(p.latitude);
      const longitude = Number(p.longitude);
      return {
        name: p.name,
        ownerId: owners[i]._id,
        address: `${p.area}, Dhaka`,
        city: "Dhaka",
        phone: `0171000${String(i + 1).padStart(4, "0")}`,
        imageUrl: "",
        location: { latitude, longitude },
        geo: { type: "Point" as const, coordinates: [longitude, latitude] as [number, number] },
        isActive: true,
      };
    })
  );

  const pharmacyById = new Map<string, { id: mongoose.Types.ObjectId; ownerId: mongoose.Types.ObjectId }>();
  pharmacyRows.forEach((p, i) =>
    pharmacyById.set(p.pharmacy_id, { id: pharmacyDocs[i]._id, ownerId: owners[i]._id })
  );

  // ---------- Medicines (reuse ones that already exist) ----------
  const medicineById = new Map<string, mongoose.Types.ObjectId>();
  for (const m of medicineRows) {
    const doc = await Medicine.findOneAndUpdate(
      { name: m.name, strength: m.strength, dosageForm: m.dosage_form },
      {
        $setOnInsert: {
          genericName: m.generic_name,
          category: m.category,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    medicineById.set(m.medicine_id, doc._id);
  }

  // ---------- Group CSV rows per pharmacy-medicine pair ----------
  const pairs = new Map<string, Row[]>();
  for (const r of dailyRows) {
    const key = `${r.pharmacy_id}|${r.medicine_id}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key)!.push(r);
  }

  const inventories: Record<string, unknown>[] = [];
  const histories: Record<string, unknown>[] = [];
  const snapshots: Record<string, unknown>[] = [];
  const demands: Record<string, unknown>[] = [];

  for (const [key, rows] of pairs) {
    const [pharmacyKey, medicineKey] = key.split("|");
    const pharmacy = pharmacyById.get(pharmacyKey)!;
    const medicineId = medicineById.get(medicineKey)!;
    const inventoryId = new mongoose.Types.ObjectId();

    rows.sort((a, b) => a.date.localeCompare(b.date));
    const last = rows[rows.length - 1];

    inventories.push({
      _id: inventoryId,
      pharmacyId: pharmacy.id,
      medicineId,
      quantity: Number(last.stock_end),
      reorderLevel: Number(last.reorder_level),
      lastUpdatedBy: pharmacy.ownerId,
      lastStockUpdatedAt: at(last.date, 15 * 60 + 30),
    });

    let current = 0;

    rows.forEach((r, index) => {
      const stockEnd = Number(r.stock_end);
      const sold = Number(r.fulfilled);
      const restock = Number(r.restock_qty);
      const requested = Number(r.requested);
      const unmet = Number(r.unmet);

      const base = { pharmacyId: pharmacy.id, medicineId, inventoryId, recordedBy: pharmacy.ownerId };

      // Day 1: record the stock the pharmacy started with.
      if (index === 0) {
        const opening = stockEnd + sold - restock;
        current = opening;
        histories.push({
          ...base,
          movementType: "INITIAL_STOCK",
          quantityChange: opening,
          quantityAfter: opening,
          note: "Opening stock",
          recordedAt: at(r.date, 2 * 60),
        });
      }

      // Supplier delivery in the morning.
      if (restock > 0) {
        current += restock;
        histories.push({
          ...base,
          movementType: "RESTOCK",
          quantityChange: restock,
          quantityAfter: current,
          note: "Supplier delivery",
          recordedAt: at(r.date, 3 * 60),
        });
      }

      // Sales spread through the day (10:00 - 21:00 Dhaka time).
      if (sold > 0) {
        const k = Math.min(sold, 2 + Math.floor(rand() * 4));
        const chunks = splitInto(sold, k, rand);
        chunks.forEach((qty, i) => {
          current -= qty;
          const minute = 4 * 60 + Math.floor(((i + rand() * 0.9) / k) * 11 * 60);
          histories.push({
            ...base,
            movementType: "SALE",
            quantityChange: -qty,
            quantityAfter: current,
            recordedAt: at(r.date, minute),
          });
        });
      }

      if (current !== stockEnd) {
        throw new Error(`Stock mismatch for ${key} on ${r.date}: ${current} vs ${stockEnd}`);
      }

      // Closing stock snapshot at 23:55 Dhaka time (17:55 UTC).
      snapshots.push({
        pharmacyId: pharmacy.id,
        medicineId,
        date: new Date(`${r.date}T00:00:00.000Z`),
        quantity: stockEnd,
        reorderLevel: Number(r.reorder_level),
        recordedAt: at(r.date, 17 * 60 + 55),
      });

      // Owners only sometimes press the "customer wanted it, we had none" button.
      if (unmet > 0 && rand() < recordRate) {
        demands.push({
          pharmacyId: pharmacy.id,
          medicineId,
          requestedQuantity: requested,
          fulfilledQuantity: sold,
          unmetQuantity: unmet,
          recordedBy: pharmacy.ownerId,
          source: "PHARMACY",
          recordedAt: at(r.date, 15 * 60 + 30),
        });
      }
    });
  }

  console.log("Writing to MongoDB:");
  await insertInBatches("inventory records", inventories, (b) => Inventory.insertMany(b, { ordered: false }));
  await insertInBatches("daily snapshots", snapshots, (b) => DailyStockSnapshot.insertMany(b, { ordered: false }));
  await insertInBatches("stock history entries", histories, (b) => StockHistory.insertMany(b, { ordered: false }));
  await insertInBatches("demand records", demands, (b) => DemandRecord.insertMany(b, { ordered: false }));

  const dates = dailyRows.map((r) => r.date).sort();
  console.log("\nSeed complete.");
  console.log(`  Users: 1 admin, ${owners.length} owners, ${normalUsers} normal users`);
  console.log(`  Pharmacies: ${pharmacyDocs.length}, medicines: ${medicineRows.length}`);
  console.log(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  console.log(`\nDemo login (all seeded accounts): password "${DEMO_PASSWORD}"`);
  console.log(`  admin${SEED_EMAIL_DOMAIN}`);
  console.log(`  owner1${SEED_EMAIL_DOMAIN}`);
  console.log(`  user1${SEED_EMAIL_DOMAIN}`);

  void admin;
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });