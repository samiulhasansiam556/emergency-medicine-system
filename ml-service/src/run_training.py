"""
Train and compare shortage-risk models.

  CSV -> features + label -> time-based split -> train 3 models
      -> compare with two rule-based baselines on UNSEEN later days
      -> keep the new model only if it beats the model that is active now.

Every run is saved with its own version, so older models, metrics and charts are kept:
    artifacts/model_<name>_<version>.joblib
    artifacts/metrics_<version>.json
    artifacts/registry.json            (one entry per run: the "model v1 vs v2" table)
    artifacts/active_model.json        (the model predictions use)
    reports/<version>/                 (charts and metrics.csv)

Usage (from ml-service/):
    python src/run_training.py --train-until 2026-09-14
    python src/run_training.py --train-until 2026-09-14 --force      # activate even if not better
"""

import argparse
import json
from datetime import date, datetime
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, confusion_matrix,
                             precision_recall_curve, roc_auc_score, roc_curve)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from features import FEATURES, HORIZON, build_features, make_matrix

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
REPORTS = ROOT / "reports"
DEFAULT_CSV = ROOT / "data" / "exports" / "inventory_daily_latest.csv"
SEED = 42


# ---------------------------------------------------------------
# Splitting (by time, never random)
# ---------------------------------------------------------------
def time_split(df: pd.DataFrame, train_until: pd.Timestamp, val_days: int):
    """
    train | gap | validation | gap | test (unseen, after train_until)

    A label looks HORIZON days ahead, so a gap of HORIZON days separates the
    parts. Otherwise a training label would peek into the validation days.
    """
    last_label_day = train_until - pd.Timedelta(days=HORIZON)
    val_start = last_label_day - pd.Timedelta(days=val_days - 1)
    train_end = val_start - pd.Timedelta(days=HORIZON + 1)

    usable = df[df["enough_history"] & df["label"].notna()]
    train = usable[usable["date"] <= train_end]
    val = usable[(usable["date"] >= val_start) & (usable["date"] <= last_label_day)]
    test = usable[usable["date"] > train_until]
    return train, val, test, (train_end, val_start, last_label_day)


# ---------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------
def flag_metrics(y: np.ndarray, flag: np.ndarray) -> dict:
    tn, fp, fn, tp = confusion_matrix(y, flag, labels=[0, 1]).ravel()
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4),
            "alert_rate": round(float(flag.mean()), 4),
            "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}


def best_f1_cutoff(y: np.ndarray, score: np.ndarray) -> float:
    prec, rec, thr = precision_recall_curve(y, score)
    f1 = 2 * prec * rec / (prec + rec + 1e-12)
    return float(thr[np.argmax(f1[:-1])])


def risk_cutoffs(y: np.ndarray, p: np.ndarray) -> tuple[float, float]:
    """HIGH = best F1 on validation. MEDIUM = lowest cutoff that still keeps recall >= 90%."""
    high = best_f1_cutoff(y, p)
    prec, rec, thr = precision_recall_curve(y, p)
    ok = np.where(rec[:-1] >= 0.90)[0]
    medium = float(thr[ok[-1]]) if len(ok) else high / 2
    return high, min(medium, high)


# ---------------------------------------------------------------
# Models
# ---------------------------------------------------------------
def make_models(pos_weight: float) -> dict:
    models = {
        "LogisticRegression": Pipeline([
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ]),
        "RandomForest": RandomForestClassifier(
            n_estimators=300, min_samples_leaf=5, class_weight="balanced_subsample",
            n_jobs=-1, random_state=SEED),
    }
    try:
        from xgboost import XGBClassifier
        models["XGBoost"] = XGBClassifier(
            n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.8,
            colsample_bytree=0.8, scale_pos_weight=pos_weight, eval_metric="logloss",
            random_state=SEED, n_jobs=-1)
    except ImportError:
        print("xgboost not installed, skipping XGBoost.")
    return models


# ---------------------------------------------------------------
# Versions, registry and the active model
# ---------------------------------------------------------------
def load_registry() -> list[dict]:
    path = ARTIFACTS / "registry.json"
    return json.loads(path.read_text()) if path.exists() else []


def next_version(registry: list[dict]) -> str:
    """Today's date. A second run on the same day becomes 2026-10-16-2, and so on."""
    today = date.today().isoformat()
    taken = {r["version"] for r in registry}
    version, n = today, 1
    while version in taken or any(ARTIFACTS.glob(f"model_*_{version}.joblib")):
        n += 1
        version = f"{today}-{n}"
    return version


def load_champion():
    """The model that is active now, or None if there is none we can still use."""
    path = ARTIFACTS / "active_model.json"
    if not path.exists():
        return None
    info = json.loads(path.read_text())
    file = ARTIFACTS / info["path"]
    if not file.exists():
        return None
    bundle = joblib.load(file)
    if bundle["features"] != FEATURES:   # trained with an older feature set
        return None
    return info, bundle


# ---------------------------------------------------------------
# Train
# ---------------------------------------------------------------
def train(csv_path, train_until, val_days: int = 20, force: bool = False) -> dict:
    train_until = pd.Timestamp(train_until)
    df = build_features(pd.read_csv(csv_path), with_label=True)

    train_df, val, test, (train_end, val_start, last_label_day) = time_split(df, train_until, val_days)
    if min(len(train_df), len(val), len(test)) == 0:
        raise SystemExit("A split is empty. Check --train-until against the data's date range.")

    categories = sorted(train_df["category"].unique())
    X_train, X_val, X_test = (make_matrix(d, categories) for d in (train_df, val, test))
    y_train, y_val, y_test = (d["label"].astype(int).to_numpy() for d in (train_df, val, test))

    print("=" * 64)
    print(f"Train:      {train_df['date'].min().date()} to {train_end.date()}  ({len(train_df):,} rows, {y_train.mean():.1%} positive)")
    print(f"Validation: {val_start.date()} to {last_label_day.date()}  ({len(val):,} rows, {y_val.mean():.1%} positive)")
    print(f"Test:       {test['date'].min().date()} to {test['date'].max().date()}  ({len(test):,} rows, {y_test.mean():.1%} positive)")
    print("=" * 64)

    # ---- baselines ----
    # 1. what most inventory systems do: alert when stock <= reorder level
    # 2. a smarter rule: alert when stock covers fewer than k days of demand
    results = {}
    results["Threshold (stock <= reorder level)"] = {
        **flag_metrics(y_test, test["below_reorder"].to_numpy()),
        "roc_auc": round(roc_auc_score(y_test, -test["stock_ratio"]), 4),
        "pr_auc": round(average_precision_score(y_test, -test["stock_ratio"]), 4),
    }
    grid = np.round(np.arange(0.5, 15.01, 0.5), 1)
    best_k = max(grid, key=lambda k: flag_metrics(y_val, (val["days_of_stock_left"] < k).to_numpy())["f1"])
    results[f"Days-of-cover rule (< {best_k:g} days)"] = {
        **flag_metrics(y_test, (test["days_of_stock_left"] < best_k).to_numpy()),
        "roc_auc": round(roc_auc_score(y_test, -test["days_of_stock_left"]), 4),
        "pr_auc": round(average_precision_score(y_test, -test["days_of_stock_left"]), 4),
    }

    # ---- ML models ----
    pos_weight = float((y_train == 0).sum() / max((y_train == 1).sum(), 1))
    fitted, probs_test, val_scores = {}, {}, {}
    for name, model in make_models(pos_weight).items():
        model.fit(X_train, y_train)
        p_val = model.predict_proba(X_val)[:, 1]
        p_test = model.predict_proba(X_test)[:, 1]
        high, medium = risk_cutoffs(y_val, p_val)
        results[name] = {
            **flag_metrics(y_test, p_test >= high),
            "roc_auc": round(roc_auc_score(y_test, p_test), 4),
            "pr_auc": round(average_precision_score(y_test, p_test), 4),
            "high_cutoff": round(high, 4), "medium_cutoff": round(medium, 4),
            "medium_plus_recall": flag_metrics(y_test, p_test >= medium)["recall"],
        }
        fitted[name] = (model, high, medium)
        probs_test[name] = p_test
        val_scores[name] = average_precision_score(y_val, p_val)

    table = pd.DataFrame(results).T[["precision", "recall", "f1", "alert_rate", "roc_auc", "pr_auc"]]
    print("\nTEST RESULTS (unseen later days)")
    print(table.to_string())
    print("\nprecision/recall/F1 for ML models use the HIGH cutoff chosen on validation data.")

    # ---- best of the three, chosen on validation data ----
    best_name = max(val_scores, key=val_scores.get)
    model, high, medium = fitted[best_name]
    new_pr = results[best_name]["pr_auc"]
    new_f1 = results[best_name]["f1"]

    # ---- should it replace the active model? both are judged on the same unseen test days ----
    champion = load_champion()
    comparison = None
    if champion is None:
        promote, reason = True, "no usable active model yet"
    else:
        info, old = champion
        p_old = old["model"].predict_proba(make_matrix(test, old["categories"]))[:, 1]
        old_pr = round(float(average_precision_score(y_test, p_old)), 4)
        old_f1 = flag_metrics(y_test, p_old >= old["cutoffs"]["high"])["f1"]
        comparison = {"version": info["version"], "model_name": info["model_name"],
                      "pr_auc": old_pr, "f1": old_f1}
        better = new_pr > old_pr
        promote = better or force
        if better:
            reason = f"new PR-AUC {new_pr} beats active model {info['version']} ({old_pr})"
        elif force:
            reason = f"forced, although PR-AUC {new_pr} does not beat active model {info['version']} ({old_pr})"
        else:
            reason = f"new PR-AUC {new_pr} does not beat active model {info['version']} ({old_pr})"

    # ---- save everything under a new version ----
    ARTIFACTS.mkdir(exist_ok=True)
    registry = load_registry()
    version = next_version(registry)
    out_dir = REPORTS / version
    out_dir.mkdir(parents=True, exist_ok=True)

    model_path = ARTIFACTS / f"model_{best_name}_{version}.joblib"
    joblib.dump({
        "model": model, "model_name": best_name, "version": version,
        "features": FEATURES, "categories": categories, "horizon": HORIZON,
        "cutoffs": {"high": high, "medium": medium},
        "trained_until": str(train_until.date()),
    }, model_path)

    split = {"train_end": str(train_end.date()), "val_start": str(val_start.date()),
             "test_start": str(test["date"].min().date()), "test_end": str(test["date"].max().date()),
             "rows": {"train": len(train_df), "val": len(val), "test": len(test)}}
    metrics = {"version": version, "split": split, "best_model": best_name,
               "activated": bool(promote), "results": results}
    (ARTIFACTS / f"metrics_{version}.json").write_text(json.dumps(metrics, indent=2))
    (ARTIFACTS / "metrics.json").write_text(json.dumps(metrics, indent=2))   # latest run
    table.to_csv(out_dir / "metrics.csv")

    registry.append({
        "version": version, "trained_at": datetime.now().isoformat(timespec="seconds"),
        "model_name": best_name, "trained_until": str(train_until.date()),
        "test_start": split["test_start"], "test_end": split["test_end"],
        "precision": results[best_name]["precision"], "recall": results[best_name]["recall"],
        "f1": new_f1, "pr_auc": new_pr, "roc_auc": results[best_name]["roc_auc"],
        "baseline_f1": results["Threshold (stock <= reorder level)"]["f1"],
        "activated": bool(promote), "compared_with": comparison, "reason": reason,
    })
    (ARTIFACTS / "registry.json").write_text(json.dumps(registry, indent=2))

    if promote:
        (ARTIFACTS / "active_model.json").write_text(json.dumps({
            "path": model_path.name, "model_name": best_name, "version": version,
            "cutoffs": {"high": high, "medium": medium},
            "trained_until": str(train_until.date()), "test_pr_auc": new_pr,
        }, indent=2))

    plot_reports(results, probs_test, y_test, test, best_name, out_dir)

    print(f"\nBest of the three (validation PR-AUC): {best_name}")
    if comparison:
        print(f"Active model so far: {comparison['model_name']} {comparison['version']} "
              f"(PR-AUC {comparison['pr_auc']}, F1 {comparison['f1']}) on the same test days")
    print("DECISION: " + ("NEW MODEL ACTIVATED" if promote else "KEPT THE PREVIOUS MODEL") + f", {reason}")
    print(f"Saved model:   {model_path.name}   (version {version})")
    print(f"Saved metrics: artifacts/metrics_{version}.json")
    print(f"Saved charts:  reports/{version}/")

    importance = feature_importance(model, list(X_train.columns))
    if importance is not None:
        print("\nTop features:")
        print(importance.head(8).round(3).to_string())

    return {"version": version, "model_name": best_name, "activated": bool(promote),
            "reason": reason, "model_path": model_path, "results": results,
            "train_until": train_until}


def feature_importance(model, columns):
    clf = model.named_steps["clf"] if hasattr(model, "named_steps") else model
    if hasattr(clf, "feature_importances_"):
        return pd.Series(clf.feature_importances_, index=columns).sort_values(ascending=False)
    if hasattr(clf, "coef_"):
        return pd.Series(np.abs(clf.coef_[0]), index=columns).sort_values(ascending=False)
    return None


# ---------------------------------------------------------------
# Charts
# ---------------------------------------------------------------
def plot_reports(results, probs, y, test, best_name, out_dir: Path):
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
    colors = {"LogisticRegression": "#2563eb", "RandomForest": "#16a34a", "XGBoost": "#9333ea"}

    # 1. ROC and precision-recall curves
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.4))
    scores = dict(probs)
    scores["Threshold rule"] = -test["stock_ratio"].to_numpy()
    scores["Days-of-cover rule"] = -test["days_of_stock_left"].to_numpy()
    for name, s in scores.items():
        style = "--" if "rule" in name else "-"
        c = colors.get(name, "#6b7280" if name == "Threshold rule" else "#d97706")
        fpr, tpr, _ = roc_curve(y, s)
        axes[0].plot(fpr, tpr, style, color=c, lw=2, label=f"{name} ({roc_auc_score(y, s):.2f})")
        p, r, _ = precision_recall_curve(y, s)
        axes[1].plot(r, p, style, color=c, lw=2, label=f"{name} ({average_precision_score(y, s):.2f})")
    axes[0].plot([0, 1], [0, 1], ":", color="#9ca3af")
    axes[0].set(title="ROC curve (AUC)", xlabel="False positive rate", ylabel="True positive rate")
    axes[1].set(title="Precision-recall curve (AP)", xlabel="Recall", ylabel="Precision")
    axes[1].axhline(y.mean(), ls=":", color="#9ca3af")
    for ax in axes:
        ax.legend(fontsize=8, loc="lower right" if ax is axes[0] else "upper right")
        ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(out_dir / "curves.png", dpi=160)
    plt.close(fig)

    # 2. precision / recall / F1 bars
    names = list(results)
    x = np.arange(len(names))
    fig, ax = plt.subplots(figsize=(11, 4.6))
    for i, (metric, c) in enumerate([("precision", "#2563eb"), ("recall", "#16a34a"), ("f1", "#9333ea")]):
        vals = [results[n][metric] for n in names]
        bars = ax.bar(x + (i - 1) * 0.26, vals, 0.26, label=metric.upper() if metric == "f1" else metric.capitalize(), color=c)
        ax.bar_label(bars, fmt="%.2f", fontsize=8, padding=2)
    ax.set_xticks(x)
    ax.set_xticklabels([n.replace(" (", "\n(") for n in names], fontsize=8)
    ax.set(ylim=(0, 1.1), title="Shortage prediction on unseen days: ML vs rule-based baselines")
    ax.legend(ncol=3, loc="upper left")
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(out_dir / "comparison.png", dpi=160)
    plt.close(fig)

    # 3. confusion matrices: threshold baseline vs best model
    base = results["Threshold (stock <= reorder level)"]
    best = results[best_name]
    fig, axes = plt.subplots(1, 2, figsize=(9, 3.9))
    for ax, (title, r) in zip(axes, [("Threshold baseline", base), (f"{best_name} (HIGH)", best)]):
        m = np.array([[r["tn"], r["fp"]], [r["fn"], r["tp"]]])
        ax.imshow(m, cmap="Blues")
        for (i, j), v in np.ndenumerate(m):
            ax.text(j, i, f"{v:,}", ha="center", va="center",
                    color="white" if v > m.max() / 2 else "black", fontsize=12)
        ax.set(title=title, xticks=[0, 1], yticks=[0, 1],
               xticklabels=["No alert", "Alert"], yticklabels=["No shortage", "Shortage"])
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
    fig.tight_layout()
    fig.savefig(out_dir / "confusion_matrices.png", dpi=160)
    plt.close(fig)


# ---------------------------------------------------------------
# CLI
# ---------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=str, default=str(DEFAULT_CSV))
    parser.add_argument("--train-until", type=str, required=True,
                        help="Last day of the history used for training (YYYY-MM-DD)")
    parser.add_argument("--val-days", type=int, default=20)
    parser.add_argument("--force", action="store_true",
                        help="Activate the new model even if it does not beat the active one")
    args = parser.parse_args()
    train(args.csv, args.train_until, args.val_days, args.force)


if __name__ == "__main__":
    main()