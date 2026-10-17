"""
Train/serve skew check.

Training computes features from the full history. Daily prediction only reads the
last WINDOW_DAYS days. If a feature secretly needs more than that, the model would
see different numbers in production than it learned from.

This script computes the features both ways for a few days and compares them.

Usage (from ml-service/):
    python src/check_skew.py
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

from features import FEATURES, MIN_HISTORY, WINDOW_DAYS, build_features

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "data" / "exports" / "inventory_daily_latest.csv"


def main() -> None:
    daily = pd.read_csv(CSV)
    daily["date"] = pd.to_datetime(daily["date"])
    full = build_features(daily, with_label=False)
    full = full[full["enough_history"]].set_index(["pharmacy_id", "medicine_id", "date"])

    last_day = daily["date"].max()
    check_days = [last_day - pd.Timedelta(days=d) for d in (0, 10, 25, 40)]

    worst = 0.0
    compared = 0
    for day in check_days:
        window = daily[(daily["date"] > day - pd.Timedelta(days=WINDOW_DAYS)) & (daily["date"] <= day)]
        feats = build_features(window, with_label=False)
        feats = feats[(feats["date"] == day) & feats["enough_history"]]
        feats = feats.set_index(["pharmacy_id", "medicine_id", "date"])

        shared = feats.index.intersection(full.index)
        diff = (feats.loc[shared, FEATURES] - full.loc[shared, FEATURES]).abs().to_numpy()
        worst = max(worst, float(np.nanmax(diff)))
        compared += len(shared)
        print(f"{day.date()}: compared {len(shared)} items, max difference {np.nanmax(diff):.6f}")

    print(f"\nWindow size: {WINDOW_DAYS} days, minimum history: {MIN_HISTORY} days")
    if worst > 1e-9:
        print(f"FAIL: features differ between full history and the window (max {worst:.6f}).")
        sys.exit(1)
    print(f"PASS: {compared} feature rows are identical in training and prediction.")


if __name__ == "__main__":
    main()