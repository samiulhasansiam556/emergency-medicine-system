"""
Feature engineering, shared by training and daily prediction.

Rule: the features of day t only use data from day t and earlier, and never look
back further than LOOKBACK_DAYS (so training and daily prediction see the same values).
The label (training only) looks at days t+1 .. t+HORIZON.

Input: the daily table made by export_data.py (one row per pharmacy, medicine, day).
"""

import numpy as np
import pandas as pd

HORIZON = 3          # predict a stock-out within the next 3 days
MIN_HISTORY = 14     # days of history needed before we trust a prediction
LOOKBACK_DAYS = 30   # the longest look-back any feature uses
WINDOW_DAYS = 35     # days of data read at prediction time (LOOKBACK_DAYS + buffer)
KEYS = ["pharmacy_id", "medicine_id"]

FEATURES = [
    "stock_end", "reorder_level", "stock_ratio", "below_reorder",
    "avg_demand_3d", "avg_demand_7d", "avg_demand_14d",
    "demand_trend", "demand_cv_7d",
    "days_of_stock_left", "days_of_stock_left_3d",
    "stockouts_30d", "days_since_stockout",
    "days_since_restock", "restock_count_30d",
    "dow_0", "dow_1", "dow_2", "dow_3", "dow_4", "dow_5", "dow_6",
]


def _days_since(flag: pd.Series, cap: int = LOOKBACK_DAYS) -> pd.Series:
    """Days since the last day where flag > 0 (0 = today). Capped at LOOKBACK_DAYS so the
    value is the same whether we look at the full history or only the last 35 days."""
    idx = np.arange(len(flag))
    last = pd.Series(np.where(flag.to_numpy() > 0, idx, np.nan)).ffill().to_numpy()
    out = np.where(np.isnan(last), cap, idx - last)
    return pd.Series(np.minimum(out, cap), index=flag.index)


def build_features(daily: pd.DataFrame, with_label: bool = True) -> pd.DataFrame:
    df = daily.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(KEYS + ["date"]).reset_index(drop=True)

    def grp():
        return df.groupby(KEYS, sort=False)

    df["history_days"] = grp().cumcount() + 1

    # ---- demand level and trend (uses requested, not sold: sold hides lost sales) ----
    for window in (3, 7, 14):
        df[f"avg_demand_{window}d"] = grp()["requested"].transform(
            lambda s, w=window: s.rolling(w).mean())
    df["demand_std_7d"] = grp()["requested"].transform(lambda s: s.rolling(7).std())
    df["demand_trend"] = (df["avg_demand_3d"] / df["avg_demand_7d"].replace(0, np.nan)).fillna(1.0)
    df["demand_cv_7d"] = (df["demand_std_7d"] / df["avg_demand_7d"].replace(0, np.nan)).fillna(0.0)

    # ---- stock position ----
    df["stock_ratio"] = df["stock_end"] / df["reorder_level"].clip(lower=1)
    df["below_reorder"] = (df["stock_end"] <= df["reorder_level"]).astype(int)
    df["days_of_stock_left"] = (df["stock_end"] / df["avg_demand_7d"].clip(lower=0.5)).clip(upper=60)
    df["days_of_stock_left_3d"] = (df["stock_end"] / df["avg_demand_3d"].clip(lower=0.5)).clip(upper=60)

    # ---- stock-out and restock history ----
    df["stockouts_30d"] = grp()["stockout"].transform(lambda s: s.rolling(30, min_periods=1).sum())
    df["days_since_stockout"] = grp()["stockout"].transform(_days_since)
    df["_restocked"] = (df["restock_qty"] > 0).astype(int)
    df["days_since_restock"] = grp()["_restocked"].transform(_days_since)
    df["restock_count_30d"] = grp()["_restocked"].transform(lambda s: s.rolling(30, min_periods=1).sum())

    # ---- day of week (no month: a few months of data cannot teach seasonality) ----
    for d in range(7):
        df[f"dow_{d}"] = (df["date"].dt.dayofweek == d).astype(int)

    # ---- label: any stock-out in the next HORIZON days ----
    if with_label:
        future = pd.concat([grp()["stockout"].shift(-k) for k in range(1, HORIZON + 1)], axis=1)
        df["label"] = np.where(future.isna().any(axis=1), np.nan, future.max(axis=1))

    # rows without enough history cannot be predicted reliably
    df["enough_history"] = (df["history_days"] >= MIN_HISTORY) & df[FEATURES].notna().all(axis=1)
    return df.drop(columns=["_restocked", "demand_std_7d"])


def make_matrix(df: pd.DataFrame, categories: list[str]) -> pd.DataFrame:
    """Model input = FEATURES + one-hot category columns (fixed list saved with the model)."""
    X = df[FEATURES].copy()
    for cat in categories:
        X[f"cat_{cat}"] = (df["category"] == cat).astype(int)
    return X