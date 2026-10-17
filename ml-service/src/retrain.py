"""
Retrain in one command.

  1. export   MongoDB -> CSV
  2. train    3 models + 2 baselines, compared on unseen days
  3. decide   the new model becomes active only if it beats the current one
  4. predict  with the active model, save to ShortagePrediction
  5. evaluate (only if --backfill-from is given) compare predictions with what happened

Usage (from ml-service/):
    python src/retrain.py                                   # monthly routine
    python src/retrain.py --train-until 2026-09-14 --backfill-from 2026-09-15
    python src/retrain.py --force                           # activate even if not better

Without --train-until, the last 30 days of data are kept unseen for testing.
"""

import argparse
from types import SimpleNamespace

import pandas as pd

import evaluate_live
import predict_batch
from export_data import export_to_csv, get_db
from run_training import train

HOLD_OUT_DAYS = 30


def step(number: int, title: str) -> None:
    print(f"\n{'=' * 64}\nSTEP {number}: {title}\n{'=' * 64}")


def run(db, args) -> dict:
    step(1, "Export from MongoDB")
    csv_path, last_day = export_to_csv(db)

    train_until = pd.Timestamp(args.train_until) if args.train_until else last_day - pd.Timedelta(days=HOLD_OUT_DAYS)
    print(f"\nTraining uses data up to {train_until.date()}; later days stay unseen for testing.")

    step(2, "Train and compare models")
    result = train(csv_path, train_until, args.val_days, args.force)

    step(3, "Prediction")
    if not result["activated"]:
        print("The active model was not changed, so there is nothing new to predict with.")
        print("(Daily predictions keep using the previous model.)")
        return result

    predict_batch.run(db, SimpleNamespace(
        date=None, date_from=args.backfill_from, date_to=None, model_file=None, dry_run=False))

    if args.backfill_from:
        step(4, "Check predictions against what actually happened")
        evaluation = evaluate_live.evaluate(db, model_version=result["version"])
        evaluate_live.show(evaluation)
        evaluate_live.save_result(evaluation)

    print(f"\nDone. Active model: {result['model_name']} (version {result['version']})")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Export, train, decide, predict and evaluate")
    parser.add_argument("--train-until", type=str, help="Last day used for training (default: latest day - 30)")
    parser.add_argument("--val-days", type=int, default=20)
    parser.add_argument("--backfill-from", type=str,
                        help="Also predict every day from this date and check the results")
    parser.add_argument("--force", action="store_true",
                        help="Activate the new model even if it does not beat the active one")
    run(get_db(), parser.parse_args())


if __name__ == "__main__":
    main()