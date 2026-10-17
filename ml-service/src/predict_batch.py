"""
Daily shortage prediction.

For every active inventory item it reads the last 35 days from MongoDB, builds the
same features used in training, predicts the risk of a stock-out in the next 3 days
and saves the result to the ShortagePrediction collection.

Usage (from ml-service/):
    python src/predict_batch.py                                   # latest day in the database
    python src/predict_batch.py --date 2026-10-14                 # one chosen day
    python src/predict_batch.py --from 2026-09-15 --to 2026-10-14 # backfill many days
    python src/predict_batch.py --dry-run                         # show results, save nothing

Re-running the same day replaces that day's predictions for the same model version.
"""

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from bson import ObjectId

from export_data import export_daily, get_db
from features import FEATURES, HORIZON, WINDOW_DAYS, build_features, make_matrix

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
DHAKA = timedelta(hours=6)


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------
def load_bundle(model_file: str | None = None) -> dict:
    active = json.loads((ARTIFACTS / "active_model.json").read_text())
    bundle = joblib.load(ARTIFACTS / (model_file or active["path"]))
    if bundle["features"] != FEATURES:
        raise SystemExit("features.py changed after this model was trained. Retrain the model first.")
    return bundle


def oid(value: str):
    return ObjectId(value) if ObjectId.is_valid(value) and len(value) == 24 else value


def active_pairs(db) -> set[tuple[str, str]]:
    """Pharmacy-medicine pairs that are in an active pharmacy's inventory."""
    pharmacies = {str(p["_id"]) for p in db["pharmacies"].find({"isActive": True}, {"_id": 1})}
    medicines = {str(m["_id"]) for m in db["medicines"].find({"isActive": True}, {"_id": 1})}
    pairs = set()
    for inv in db["inventories"].find({}, {"pharmacyId": 1, "medicineId": 1}):
        ph, med = str(inv["pharmacyId"]), str(inv["medicineId"])
        if ph in pharmacies and med in medicines:
            pairs.add((ph, med))
    return pairs


def latest_snapshot_day(db) -> pd.Timestamp:
    doc = db["dailystocksnapshots"].find_one({}, {"date": 1}, sort=[("date", -1)])
    if not doc:
        raise SystemExit("No DailyStockSnapshot data found.")
    return pd.Timestamp(doc["date"]).normalize()


def risk_level(p: np.ndarray, high: float, medium: float) -> np.ndarray:
    return np.where(p >= high, "HIGH", np.where(p >= medium, "MEDIUM", "LOW"))


# ---------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------
def predict_days(db, start: pd.Timestamp, end: pd.Timestamp, bundle: dict, backfill: bool) -> list[dict]:
    pairs = active_pairs(db)
    if not pairs:
        raise SystemExit("No active inventory items found.")

    # Read only the days we need: the window before the first day, up to the last day.
    daily = export_daily(db, since=start - timedelta(days=WINDOW_DAYS - 1), until=end)
    keep = pd.MultiIndex.from_frame(daily[["pharmacy_id", "medicine_id"]]).isin(list(pairs))
    daily = daily[keep]

    feats = build_features(daily, with_label=False)
    feats = feats[(feats["date"] >= start) & (feats["date"] <= end)]
    ready = feats[feats["enough_history"]].copy()

    p = bundle["model"].predict_proba(make_matrix(ready, bundle["categories"]))[:, 1]
    ready["probability"] = p
    ready["risk"] = risk_level(p, bundle["cutoffs"]["high"], bundle["cutoffs"]["medium"])

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    docs: list[dict] = []

    def generated_at(day: pd.Timestamp) -> datetime:
        # In a backfill we pretend the job ran at 03:00 Dhaka time the next morning.
        return (day + timedelta(days=1, hours=3) - DHAKA).to_pydatetime() if backfill else now

    base = {
        "predictionDays": HORIZON,
        "modelName": bundle["model_name"],
        "modelVersion": bundle["version"],
        "createdAt": now,
        "updatedAt": now,
    }

    for row in ready.itertuples():
        docs.append({
            **base,
            "pharmacyId": oid(row.pharmacy_id),
            "medicineId": oid(row.medicine_id),
            "riskLevel": row.risk,
            "shortageProbability": round(float(row.probability), 4),
            "asOfDate": row.date.to_pydatetime(),
            "predictedForDate": (row.date + timedelta(days=HORIZON)).to_pydatetime(),
            "baselineFlag": bool(row.below_reorder),
            "features": {
                "stockEnd": int(row.stock_end),
                "reorderLevel": int(row.reorder_level),
                "avgDemand7d": round(float(row.avg_demand_7d), 2),
                "daysOfStockLeft": round(float(row.days_of_stock_left), 2),
                "demandTrend": round(float(row.demand_trend), 2),
            },
            "generatedAt": generated_at(row.date),
        })

    # Active items without enough recent data get INSUFFICIENT_DATA instead of a guess.
    for day in pd.date_range(start, end, freq="D"):
        have = set(zip(ready.loc[ready["date"] == day, "pharmacy_id"],
                       ready.loc[ready["date"] == day, "medicine_id"]))
        for ph, med in sorted(pairs - have):
            docs.append({
                **base,
                "pharmacyId": oid(ph), "medicineId": oid(med),
                "riskLevel": "INSUFFICIENT_DATA",
                "asOfDate": day.to_pydatetime(),
                "predictedForDate": (day + timedelta(days=HORIZON)).to_pydatetime(),
                "generatedAt": generated_at(day),
            })
    return docs



def sync_model_run(db, bundle: dict) -> None:
    """
    Tell the database which model is active, so the backend can show only its predictions.
    One document per model version in "modelruns"; exactly one has isActive = true.
    """
    version = bundle["version"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    info = {
        "modelName": bundle["model_name"],
        "trainedUntil": bundle.get("trained_until"),
        "cutoffs": {"high": round(bundle["cutoffs"]["high"], 4), "medium": round(bundle["cutoffs"]["medium"], 4)},
        "horizonDays": bundle.get("horizon", HORIZON),
    }
    metrics_file = ARTIFACTS / f"metrics_{version}.json"
    if metrics_file.exists():
        run = json.loads(metrics_file.read_text())
        best = run["results"][run["best_model"]]
        baseline = run["results"]["Threshold (stock <= reorder level)"]
        info["metrics"] = {
            "precision": best["precision"], "recall": best["recall"], "f1": best["f1"],
            "prAuc": best["pr_auc"], "rocAuc": best["roc_auc"], "baselineF1": baseline["f1"],
        }
        info["testPeriod"] = {"start": run["split"]["test_start"], "end": run["split"]["test_end"]}

    runs = db["modelruns"]
    runs.update_many({"version": {"$ne": version}}, {"$set": {"isActive": False, "updatedAt": now}})
    runs.update_one(
        {"version": version},
        {"$set": {**info, "version": version, "isActive": True, "activatedAt": now, "updatedAt": now},
         "$setOnInsert": {"createdAt": now}},
        upsert=True,
    )
def save(db, docs: list[dict], start: pd.Timestamp, end: pd.Timestamp, version: str) -> None:
    col = db["shortagepredictions"]
    removed = col.delete_many({
        "asOfDate": {"$gte": start.to_pydatetime(), "$lte": end.to_pydatetime()},
        "modelVersion": version,
    }).deleted_count
    for i in range(0, len(docs), 5000):
        col.insert_many(docs[i:i + 5000])
    if removed:
        print(f"Replaced {removed:,} earlier predictions for the same days and model version.")


# ---------------------------------------------------------------
# CLI
# ---------------------------------------------------------------
def run(db, args) -> list[dict]:
    bundle = load_bundle(args.model_file)
    backfill = args.date_from is not None

    if backfill:
        start = pd.Timestamp(args.date_from)
        end = pd.Timestamp(args.date_to) if args.date_to else latest_snapshot_day(db)
    else:
        start = end = pd.Timestamp(args.date) if args.date else latest_snapshot_day(db)

    docs = predict_days(db, start, end, bundle, backfill)

    counts = pd.Series([d["riskLevel"] for d in docs]).value_counts()
    print(f"Model: {bundle['model_name']} ({bundle['version']}), "
          f"HIGH if p >= {bundle['cutoffs']['high']:.3f}, MEDIUM if p >= {bundle['cutoffs']['medium']:.3f}")
    print(f"Days: {start.date()} to {end.date()}   Predictions: {len(docs):,}")
    for level in ("HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"):
        print(f"  {level:<18}{int(counts.get(level, 0)):>7,}")

    if args.dry_run:
        print("Dry run: nothing was saved.")
    else:
        save(db, docs, start, end, bundle["version"])
        if not args.model_file:
            sync_model_run(db, bundle)
        print("Saved to ShortagePrediction.")
    return docs


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict shortage risk for active inventory")
    parser.add_argument("--date", type=str, help="Last day of data to use (default: latest snapshot day)")
    parser.add_argument("--from", dest="date_from", type=str, help="Backfill: first day")
    parser.add_argument("--to", dest="date_to", type=str, help="Backfill: last day (default: latest)")
    parser.add_argument("--model-file", type=str, help="Use this file in artifacts/ instead of the active model")
    parser.add_argument("--dry-run", action="store_true")
    run(get_db(), parser.parse_args())


if __name__ == "__main__":
    main()