"""
Compare saved predictions with what actually happened.

A prediction made on day D says "a stock-out will happen within D+1 .. D+3".
Once those days are in the database we can check it. Only predictions whose 3 days
have already passed can be checked; the rest stay "pending".

The result is also written back onto each prediction (actualStockout, evaluatedAt),
so the admin dashboard can show how accurate the system really is.

Usage (from ml-service/):
    python src/evaluate_live.py
    python src/evaluate_live.py --model-version 2026-10-15 --from 2026-09-15 --to 2026-10-14
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from pymongo import UpdateOne
from sklearn.metrics import average_precision_score, roc_auc_score

from export_data import export_daily, get_db
from features import HORIZON, build_features
from run_training import flag_metrics

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"


def evaluate(db, model_version=None, date_from=None, date_to=None, write_back=True) -> dict:
    if model_version is None:
        model_version = json.loads((ARTIFACTS / "active_model.json").read_text())["version"]

    query = {"modelVersion": model_version, "asOfDate": {"$exists": True}}
    if date_from:
        query["asOfDate"]["$gte"] = pd.Timestamp(date_from).to_pydatetime()
    if date_to:
        query["asOfDate"]["$lte"] = pd.Timestamp(date_to).to_pydatetime()

    preds = pd.DataFrame(list(db["shortagepredictions"].find(query)))
    if preds.empty:
        raise SystemExit("No predictions found. Run predict_batch.py first.")

    preds = preds.rename(columns={"_id": "doc_id"})  # itertuples() mangles names starting with "_"
    preds["pharmacy_id"] = preds["pharmacyId"].astype(str)
    preds["medicine_id"] = preds["medicineId"].astype(str)
    preds["date"] = pd.to_datetime(preds["asOfDate"]).dt.normalize()

    # what actually happened: any stock-out in the next 3 days
    daily = export_daily(db, since=preds["date"].min(), until=preds["date"].max() + pd.Timedelta(days=HORIZON))
    truth = build_features(daily, with_label=True)[["pharmacy_id", "medicine_id", "date", "label"]]
    df = preds.merge(truth, on=["pharmacy_id", "medicine_id", "date"], how="left")

    scored = df[df["riskLevel"] != "INSUFFICIENT_DATA"]
    checked = scored[scored["label"].notna()].copy()
    pending = len(scored) - len(checked)
    if checked.empty:
        raise SystemExit("Nothing to check yet: the 3 days after each prediction have not happened.")

    y = checked["label"].astype(int).to_numpy()
    high = (checked["riskLevel"] == "HIGH").to_numpy()
    medium_plus = checked["riskLevel"].isin(["MEDIUM", "HIGH"]).to_numpy()
    baseline = checked["baselineFlag"].astype(bool).to_numpy()
    prob = checked["shortageProbability"].astype(float).to_numpy()

    result = {
        "model_version": model_version,
        "days": [str(checked["date"].min().date()), str(checked["date"].max().date())],
        "predictions_checked": len(checked),
        "pending": int(pending),
        "insufficient_data": int((df["riskLevel"] == "INSUFFICIENT_DATA").sum()),
        "actual_shortage_rate": round(float(y.mean()), 4),
        "roc_auc": round(float(roc_auc_score(y, prob)), 4),
        "pr_auc": round(float(average_precision_score(y, prob)), 4),
        "ml_high": flag_metrics(y, high),
        "ml_medium_plus": flag_metrics(y, medium_plus),
        "threshold_baseline": flag_metrics(y, baseline),
        "by_risk_level": {
            level: {"count": int(len(g)), "shortage_rate": round(float(g["label"].mean()), 4)}
            for level, g in checked.groupby("riskLevel")
        },
    }

    if write_back:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        ops = [
            UpdateOne({"_id": row.doc_id}, {"$set": {"actualStockout": bool(row.label), "evaluatedAt": now}})
            for row in checked.itertuples()
        ]
        for i in range(0, len(ops), 5000):
            db["shortagepredictions"].bulk_write(ops[i:i + 5000], ordered=False)

    return result


def show(r: dict) -> None:
    print(f"Model version: {r['model_version']}")
    print(f"Days checked:  {r['days'][0]} to {r['days'][1]}")
    print(f"Predictions:   {r['predictions_checked']:,} checked, {r['pending']:,} pending, "
          f"{r['insufficient_data']:,} had insufficient data")
    print(f"Actual shortage rate: {r['actual_shortage_rate']:.1%}   ROC-AUC {r['roc_auc']}   PR-AUC {r['pr_auc']}\n")

    rows = {"ML (HIGH risk)": r["ml_high"], "ML (MEDIUM or HIGH)": r["ml_medium_plus"],
            "Threshold baseline": r["threshold_baseline"]}
    table = pd.DataFrame(rows).T[["precision", "recall", "f1", "alert_rate", "tp", "fp", "fn", "tn"]]
    print(table.to_string())

    print("\nWhen the system says...   how often a shortage really happened")
    for level in ("LOW", "MEDIUM", "HIGH"):
        info = r["by_risk_level"].get(level)
        if info:
            print(f"  {level:<7} ({info['count']:>5,} predictions)   {info['shortage_rate']:.1%}")


def save_result(result: dict) -> None:
    """Keep one file per model version, plus a 'latest' copy."""
    ARTIFACTS.mkdir(exist_ok=True)
    text = json.dumps(result, indent=2)
    (ARTIFACTS / f"live_evaluation_{result['model_version']}.json").write_text(text)
    (ARTIFACTS / "live_evaluation.json").write_text(text)
    print(f"\nSaved: artifacts/live_evaluation_{result['model_version']}.json")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-version", type=str)
    parser.add_argument("--from", dest="date_from", type=str)
    parser.add_argument("--to", dest="date_to", type=str)
    parser.add_argument("--no-write", action="store_true", help="Do not save outcomes onto the predictions")
    args = parser.parse_args()

    result = evaluate(get_db(), args.model_version, args.date_from, args.date_to, not args.no_write)
    show(result)
    save_result(result)


if __name__ == "__main__":
    main()