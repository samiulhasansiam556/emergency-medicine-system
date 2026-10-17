"""
Export daily inventory data from MongoDB into one CSV for ML training.

Joins three collections into one row per (pharmacy, medicine, day):
  DailyStockSnapshot -> stock_end, reorder_level      (one row per day)
  StockHistory       -> sold, restock_qty, wasted...  (summed per day)
  DemandRecord       -> requested, unmet              (summed per day)

Usage (from ml-service/):
    python src/export_data.py
    python src/export_data.py --until 2026-09-14
"""

import argparse
import os
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]          # ml-service/
OUT_DIR = ROOT / "data" / "exports"
TIMEZONE = "Asia/Dhaka"
KEYS = ["pharmacy_id", "medicine_id", "date"]

# Mongoose pluralises model names into these collection names.
COLLECTIONS = {
    "snapshots": "dailystocksnapshots",
    "history": "stockhistories",
    "demand": "demandrecords",
    "medicines": "medicines",
}


# ---------------------------------------------------------------
# Connection
# ---------------------------------------------------------------
def get_db():
    from dotenv import load_dotenv
    from pymongo import MongoClient

    # Reuse the backend's .env so the URI is kept in one place.
    for env_file in (ROOT / ".env", ROOT.parent / "backend" / ".env"):
        if env_file.exists():
            load_dotenv(env_file)
            break

    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise SystemExit("MONGODB_URI not found. Add it to backend/.env or ml-service/.env")

    client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    try:
        return client.get_default_database()
    except Exception:
        return client["test"]  # Mongoose's default when the URI has no db name


# ---------------------------------------------------------------
# Reading
# ---------------------------------------------------------------
def read(db, name: str, fields: list[str], query: dict | None = None) -> pd.DataFrame:
    projection = {f: 1 for f in fields}
    projection["_id"] = 0
    rows = list(db[name].find(query or {}, projection))
    df = pd.DataFrame(rows, columns=fields)
    for col in ("pharmacyId", "medicineId"):
        if col in df.columns:
            df[col] = df[col].astype(str)
    return df


def to_dhaka_day(series: pd.Series) -> pd.Series:
    """UTC timestamps -> calendar day in Bangladesh time (naive, midnight)."""
    ts = pd.to_datetime(series, utc=True)
    return ts.dt.tz_convert(TIMEZONE).dt.normalize().dt.tz_localize(None)


# ---------------------------------------------------------------
# Building the daily table
# ---------------------------------------------------------------
def export_daily(db, since=None, until=None) -> pd.DataFrame:
    """since/until (optional) limit the days read. Daily prediction only needs ~35 days."""
    snap_q, hist_q, dem_q = {}, {}, {}
    if since is not None:
        start = pd.Timestamp(since).to_pydatetime()
        snap_q["date"] = {"$gte": start}
        # history/demand times are UTC and the Dhaka day starts 6 h earlier, so add slack
        hist_q["recordedAt"] = {"$gte": start - timedelta(days=1)}
        dem_q["recordedAt"] = {"$gte": start - timedelta(days=1)}
    if until is not None:
        end = pd.Timestamp(until).to_pydatetime()
        snap_q.setdefault("date", {})["$lte"] = end
        hist_q.setdefault("recordedAt", {})["$lt"] = end + timedelta(days=2)
        dem_q.setdefault("recordedAt", {})["$lt"] = end + timedelta(days=2)

    snap = read(db, COLLECTIONS["snapshots"],
                ["pharmacyId", "medicineId", "date", "quantity", "reorderLevel"], snap_q)
    hist = read(db, COLLECTIONS["history"],
                ["pharmacyId", "medicineId", "movementType", "quantityChange", "recordedAt"], hist_q)
    dem = read(db, COLLECTIONS["demand"],
               ["pharmacyId", "medicineId", "requestedQuantity", "unmetQuantity", "recordedAt"], dem_q)

    if snap.empty:
        raise SystemExit("No DailyStockSnapshot data found. Seed the database first.")

    snap = snap.rename(columns={"pharmacyId": "pharmacy_id", "medicineId": "medicine_id",
                                "quantity": "stock_end", "reorderLevel": "reorder_level"})
    # Snapshot dates are stored as UTC midnight of the local calendar day.
    snap["date"] = pd.to_datetime(snap["date"], utc=True).dt.tz_localize(None).dt.normalize()
    snap = snap.drop_duplicates(KEYS, keep="last")

    # ---- stock movements per day ----
    flows = pd.DataFrame(columns=KEYS + ["sold", "restock_qty", "wasted_qty", "adjustment_qty"])
    if not hist.empty:
        hist = hist.rename(columns={"pharmacyId": "pharmacy_id", "medicineId": "medicine_id"})
        hist["date"] = to_dhaka_day(hist["recordedAt"])
        pivot = hist.pivot_table(index=KEYS, columns="movementType",
                                 values="quantityChange", aggfunc="sum", fill_value=0)
        for col in ("SALE", "RESTOCK", "EXPIRED", "DAMAGED", "ADJUSTMENT"):
            if col not in pivot.columns:
                pivot[col] = 0
        flows = pd.DataFrame({
            "sold": -pivot["SALE"],
            "restock_qty": pivot["RESTOCK"],
            "wasted_qty": -(pivot["EXPIRED"] + pivot["DAMAGED"]),
            "adjustment_qty": pivot["ADJUSTMENT"],
        }).reset_index()

    # ---- demand reported by the pharmacy ----
    demand = pd.DataFrame(columns=KEYS + ["reported_requested", "unmet"])
    if not dem.empty:
        dem = dem.rename(columns={"pharmacyId": "pharmacy_id", "medicineId": "medicine_id"})
        dem["date"] = to_dhaka_day(dem["recordedAt"])
        demand = (dem.groupby(KEYS)[["requestedQuantity", "unmetQuantity"]].sum()
                  .rename(columns={"requestedQuantity": "reported_requested",
                                   "unmetQuantity": "unmet"}).reset_index())

    df = (snap.merge(flows, on=KEYS, how="left").merge(demand, on=KEYS, how="left"))
    for col in ["sold", "restock_qty", "wasted_qty", "adjustment_qty", "reported_requested", "unmet"]:
        df[col] = df[col].fillna(0)

    df = fill_missing_days(df)

    # If the owner did not report demand, the best estimate is what was sold.
    df["requested"] = np.maximum(df["reported_requested"], df["sold"])
    # A stock-out is something we can observe directly: the shelf is empty at day end.
    df["stockout"] = (df["stock_end"] == 0).astype(int)

    # medicine category for the model
    med_cat = db[COLLECTIONS["medicines"]].find({}, {"category": 1})
    cat_map = {str(m["_id"]): m.get("category", "Unknown") for m in med_cat}
    df["category"] = df["medicine_id"].map(cat_map).fillna("Unknown")

    cols = ["date", "pharmacy_id", "medicine_id", "category", "stock_end", "reorder_level",
            "sold", "restock_qty", "wasted_qty", "adjustment_qty", "requested", "unmet",
            "stockout", "missing_snapshot"]
    df = df[cols].sort_values(["pharmacy_id", "medicine_id", "date"]).reset_index(drop=True)
    int_cols = [c for c in cols if c not in ("date", "pharmacy_id", "medicine_id", "category")]
    df[int_cols] = df[int_cols].round().astype(int)
    return df


def fill_missing_days(df: pd.DataFrame) -> pd.DataFrame:
    """If the nightly job missed a day, carry the previous stock forward and flag it."""
    parts = []
    for (ph, med), g in df.groupby(["pharmacy_id", "medicine_id"], sort=False):
        g = g.set_index("date").sort_index()
        g = g.reindex(pd.date_range(g.index.min(), g.index.max(), freq="D"))
        g["missing_snapshot"] = g["stock_end"].isna().astype(int)
        g[["stock_end", "reorder_level"]] = g[["stock_end", "reorder_level"]].ffill()
        flow_cols = ["sold", "restock_qty", "wasted_qty", "adjustment_qty",
                     "reported_requested", "unmet"]
        g[flow_cols] = g[flow_cols].fillna(0)
        g["pharmacy_id"], g["medicine_id"] = ph, med
        parts.append(g.rename_axis("date").reset_index())
    return pd.concat(parts, ignore_index=True)


# ---------------------------------------------------------------
# Saving
# ---------------------------------------------------------------
def export_to_csv(db, until: str | None = None):
    """Export everything to data/exports/. Returns (csv path, last day in the data)."""
    df = export_daily(db)
    if until:
        df = df[df["date"] <= pd.Timestamp(until)]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamped = OUT_DIR / f"inventory_daily_{date.today().isoformat()}.csv"
    latest = OUT_DIR / "inventory_daily_latest.csv"
    df.to_csv(stamped, index=False)
    df.to_csv(latest, index=False)

    pairs = df.groupby(["pharmacy_id", "medicine_id"]).ngroups
    print(f"Rows: {len(df):,}")
    print(f"Pharmacy-medicine pairs: {pairs}")
    print(f"Date range: {df['date'].min().date()} to {df['date'].max().date()}")
    print(f"Days with stock-out (stock = 0): {df['stockout'].mean():.2%}")
    print(f"Days with a reported unmet demand: {(df['unmet'] > 0).mean():.2%}")
    print(f"Missing snapshot days filled: {int(df['missing_snapshot'].sum())}")
    print(f"Saved: {stamped}")
    print(f"Saved: {latest}")
    return latest, df["date"].max()


# ---------------------------------------------------------------
# CLI
# ---------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Export daily inventory data to CSV")
    parser.add_argument("--until", type=str, default=None,
                        help="Only keep days up to this date (YYYY-MM-DD)")
    args = parser.parse_args()
    export_to_csv(get_db(), args.until)


if __name__ == "__main__":
    main()