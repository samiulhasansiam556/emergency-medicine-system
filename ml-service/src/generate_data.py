"""
Synthetic pharmacy inventory simulator.

Simulates daily demand, sales, restocking and stock-outs for many
pharmacy x medicine pairs. The output is used to train and evaluate
the shortage-risk model.

Realism that makes the problem non-trivial:
  * weekday pattern, seasonal pattern per medicine category, slow trend
  * city-wide demand spikes (outbreak-like events) shared by all pharmacies
  * each pharmacy has its own size and supplier reliability
  * supplier delays: some orders arrive much later than usual
  * pharmacies reorder using a fixed reorder level (the baseline policy)

Usage:
    python src/generate_data.py
    python src/generate_data.py --pharmacies 30 --days 730 --seed 7
    python src/generate_data.py --pharmacies 10 --medicines 20 --days 120
"""

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

# name, generic, category, base daily demand (units per day for an average pharmacy)
MEDICINES = [
    ("Napa 500", "Paracetamol", "Pain Relief", 14),
    ("Napa Extra", "Paracetamol + Caffeine", "Pain Relief", 7),
    ("Ace Plus", "Paracetamol", "Pain Relief", 6),
    ("Brufen 400", "Ibuprofen", "Pain Relief", 5),
    ("Fexo 120", "Fexofenadine", "Allergy", 6),
    ("Alatrol", "Cetirizine", "Allergy", 8),
    ("Montair 10", "Montelukast", "Allergy", 4),
    ("Seclo 20", "Omeprazole", "Gastric", 12),
    ("Losectil 20", "Omeprazole", "Gastric", 7),
    ("Pantonix 40", "Pantoprazole", "Gastric", 5),
    ("ORS Saline", "Oral Rehydration Salts", "Diarrhea", 10),
    ("Flagyl 400", "Metronidazole", "Diarrhea", 5),
    ("Zimax 500", "Azithromycin", "Antibiotic", 6),
    ("Cef-3 200", "Cefixime", "Antibiotic", 5),
    ("Amoxil 500", "Amoxicillin", "Antibiotic", 6),
    ("Ciprocin 500", "Ciprofloxacin", "Antibiotic", 4),
    ("Tusca Syrup", "Cough Syrup", "Cold & Flu", 6),
    ("Sinex Drops", "Oxymetazoline", "Cold & Flu", 4),
    ("Histacin", "Chlorpheniramine", "Cold & Flu", 5),
    ("Metformin 500", "Metformin", "Diabetes", 7),
    ("Glimepiride 2", "Glimepiride", "Diabetes", 4),
    ("Insulin 70/30", "Human Insulin", "Diabetes", 2),
    ("Amlodipine 5", "Amlodipine", "Blood Pressure", 7),
    ("Losartan 50", "Losartan", "Blood Pressure", 6),
    ("Atenolol 50", "Atenolol", "Blood Pressure", 4),
    ("Salbutamol Inhaler", "Salbutamol", "Respiratory", 2),
    ("Ventolin Nebules", "Salbutamol", "Respiratory", 2),
    ("Vitamin C 500", "Ascorbic Acid", "Vitamin", 8),
    ("Calcium + D3", "Calcium + Vitamin D3", "Vitamin", 5),
    ("Dexamethasone 4", "Dexamethasone", "Emergency", 2),
]

# peak month (1-12) and seasonal strength per category
SEASON = {
    "Pain Relief": (None, 0.0),
    "Allergy": (3, 0.25),
    "Gastric": (None, 0.0),
    "Diarrhea": (7, 0.45),
    "Antibiotic": (None, 0.0),
    "Cold & Flu": (1, 0.55),
    "Diabetes": (None, 0.0),
    "Blood Pressure": (None, 0.0),
    "Respiratory": (12, 0.35),
    "Vitamin": (None, 0.0),
    "Emergency": (None, 0.0),
}

# strength and dosage form (used when the data is seeded into MongoDB)
STRENGTH_FORM = {
    "Napa 500": ("500 mg", "TABLET"),
    "Napa Extra": ("500 mg + 65 mg", "TABLET"),
    "Ace Plus": ("500 mg", "TABLET"),
    "Brufen 400": ("400 mg", "TABLET"),
    "Fexo 120": ("120 mg", "TABLET"),
    "Alatrol": ("10 mg", "TABLET"),
    "Montair 10": ("10 mg", "TABLET"),
    "Seclo 20": ("20 mg", "CAPSULE"),
    "Losectil 20": ("20 mg", "CAPSULE"),
    "Pantonix 40": ("40 mg", "TABLET"),
    "ORS Saline": ("20.5 g", "OTHER"),
    "Flagyl 400": ("400 mg", "TABLET"),
    "Zimax 500": ("500 mg", "TABLET"),
    "Cef-3 200": ("200 mg", "CAPSULE"),
    "Amoxil 500": ("500 mg", "CAPSULE"),
    "Ciprocin 500": ("500 mg", "TABLET"),
    "Tusca Syrup": ("100 ml", "SYRUP"),
    "Sinex Drops": ("0.05%", "DROPS"),
    "Histacin": ("4 mg", "TABLET"),
    "Metformin 500": ("500 mg", "TABLET"),
    "Glimepiride 2": ("2 mg", "TABLET"),
    "Insulin 70/30": ("100 IU/ml", "INJECTION"),
    "Amlodipine 5": ("5 mg", "TABLET"),
    "Losartan 50": ("50 mg", "TABLET"),
    "Atenolol 50": ("50 mg", "TABLET"),
    "Salbutamol Inhaler": ("100 mcg", "INHALER"),
    "Ventolin Nebules": ("2.5 mg/2.5 ml", "OTHER"),
    "Vitamin C 500": ("500 mg", "TABLET"),
    "Calcium + D3": ("500 mg + 200 IU", "TABLET"),
    "Dexamethasone 4": ("4 mg", "INJECTION"),
}

WEEKDAY = np.array([1.00, 1.00, 0.95, 0.95, 0.80, 0.75, 1.10])  # Mon..Sun

AREAS = [
    ("Mirpur", 23.8069, 90.3687),
    ("Uttara", 23.8759, 90.3795),
    ("Dhanmondi", 23.7461, 90.3742),
    ("Gulshan", 23.7925, 90.4078),
    ("Mohammadpur", 23.7662, 90.3589),
    ("Banani", 23.7937, 90.4066),
    ("Motijheel", 23.7330, 90.4172),
    ("Farmgate", 23.7561, 90.3872),
]


def seasonal_factor(dates: pd.DatetimeIndex, category: str) -> np.ndarray:
    peak_month, strength = SEASON[category]
    if peak_month is None:
        return np.ones(len(dates))
    day_of_year = dates.dayofyear.to_numpy()
    peak_day = (peak_month - 1) * 30.4 + 15
    angle = 2 * np.pi * (day_of_year - peak_day) / 365.25
    return 1 + strength * np.cos(angle)


def outbreak_series(rng: np.random.Generator, n_days: int) -> np.ndarray:
    """City-wide demand multiplier for one medicine: mostly 1, with occasional spikes."""
    factor = np.ones(n_days)
    day = 0
    while day < n_days:
        if rng.random() < 0.012:  # roughly 4 spikes a year
            length = int(rng.integers(5, 15))
            peak = rng.uniform(1.8, 3.5)
            span = min(length, n_days - day)
            # ramp up then decay
            shape = np.sin(np.linspace(0.15, np.pi - 0.15, span))
            factor[day : day + span] *= 1 + (peak - 1) * shape
            day += length
        else:
            day += 1
    return factor


def simulate_pair(
    rng: np.random.Generator,
    lam: np.ndarray,
    reorder_level: int,
    order_up_to: int,
    reliability: float,
    n_days: int,
) -> dict:
    """Day-by-day inventory simulation for one pharmacy-medicine pair."""
    demand = rng.poisson(lam)

    stock = int(order_up_to * rng.uniform(0.5, 1.0))
    pending_qty = 0
    pending_eta = -1  # day index when the order arrives

    stock_end = np.zeros(n_days, dtype=int)
    fulfilled = np.zeros(n_days, dtype=int)
    restock_qty = np.zeros(n_days, dtype=int)
    order_pending = np.zeros(n_days, dtype=bool)

    for t in range(n_days):
        # delivery arrives at the start of the day
        if pending_qty > 0 and t >= pending_eta:
            stock += pending_qty
            restock_qty[t] = pending_qty
            pending_qty = 0
            pending_eta = -1

        sold = min(stock, int(demand[t]))
        stock -= sold
        fulfilled[t] = sold
        stock_end[t] = stock

        # end-of-day reorder decision (fixed reorder-level policy)
        if pending_qty == 0 and stock <= reorder_level:
            pending_qty = order_up_to - stock
            lead = int(rng.integers(1, 4))  # normal lead time: 1-3 days
            if rng.random() > reliability:  # supplier problem: long delay
                lead += int(rng.integers(3, 11))
            pending_eta = t + 1 + lead

        order_pending[t] = pending_qty > 0

    return {
        "demand": demand,
        "fulfilled": fulfilled,
        "stock_end": stock_end,
        "restock_qty": restock_qty,
        "order_pending": order_pending,
    }


def generate(
    n_pharmacies: int,
    n_days: int,
    burn_in: int,
    seed: int,
    n_medicines: int = len(MEDICINES),
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)

    total_days = n_days + burn_in
    all_dates = pd.date_range(end="2026-10-14", periods=total_days, freq="D")

    pharmacies = []
    for i in range(n_pharmacies):
        area, lat, lng = AREAS[i % len(AREAS)]
        pharmacies.append(
            {
                "pharmacy_id": f"P{i + 1:03d}",
                "name": f"{area} Pharmacy {i // len(AREAS) + 1}",
                "area": area,
                "latitude": round(lat + rng.normal(0, 0.006), 6),
                "longitude": round(lng + rng.normal(0, 0.006), 6),
                "size_factor": float(np.clip(rng.lognormal(0, 0.4), 0.5, 2.2)),
            }
        )
    pharmacies_df = pd.DataFrame(pharmacies)

    # pick medicines spread evenly over the catalog so categories stay mixed
    n_medicines = max(1, min(n_medicines, len(MEDICINES)))
    picked = sorted(set(np.linspace(0, len(MEDICINES) - 1, n_medicines).round().astype(int)))
    chosen = [MEDICINES[i] for i in picked]

    medicines_df = pd.DataFrame(
        [
            {
                "medicine_id": f"M{i + 1:03d}",
                "name": n,
                "generic_name": g,
                "category": c,
                "base_demand": b,
                "strength": STRENGTH_FORM[n][0],
                "dosage_form": STRENGTH_FORM[n][1],
            }
            for i, (n, g, c, b) in enumerate(chosen)
        ]
    )

    # city-wide spikes, shared by all pharmacies for the same medicine
    outbreaks = {
        row.medicine_id: outbreak_series(rng, total_days)
        for row in medicines_df.itertuples()
    }

    frames = []
    for ph in pharmacies_df.itertuples():
        for med in medicines_df.itertuples():
            # pair-specific personality
            taste = rng.lognormal(0, 0.25)
            base = max(0.4, med.base_demand * ph.size_factor * taste)
            trend = rng.normal(0.0, 0.0004)  # slow drift per day
            reliability = rng.uniform(0.78, 0.97)

            reorder_level = max(5, int(round(base * rng.uniform(3.0, 5.5))))
            order_up_to = reorder_level + max(8, int(round(base * rng.uniform(6, 10))))

            lam = (
                base
                * WEEKDAY[all_dates.dayofweek.to_numpy()]
                * seasonal_factor(all_dates, med.category)
                * (1 + trend * np.arange(total_days))
                * outbreaks[med.medicine_id]
            )
            lam = np.clip(lam, 0.05, None)

            sim = simulate_pair(
                rng, lam, reorder_level, order_up_to, reliability, total_days
            )

            df = pd.DataFrame(
                {
                    "date": all_dates,
                    "pharmacy_id": ph.pharmacy_id,
                    "medicine_id": med.medicine_id,
                    "stock_end": sim["stock_end"],
                    "reorder_level": reorder_level,
                    "requested": sim["demand"],
                    "fulfilled": sim["fulfilled"],
                    "restock_qty": sim["restock_qty"],
                    "order_pending": sim["order_pending"],
                }
            )
            frames.append(df.iloc[burn_in:])  # drop warm-up period

    data = pd.concat(frames, ignore_index=True)
    data["unmet"] = data["requested"] - data["fulfilled"]
    data["stockout"] = (data["unmet"] > 0).astype(int)
    data["date"] = data["date"].dt.strftime("%Y-%m-%d")

    return data, pharmacies_df, medicines_df


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic inventory data")
    parser.add_argument("--pharmacies", type=int, default=20)
    parser.add_argument("--medicines", type=int, default=len(MEDICINES))
    parser.add_argument("--days", type=int, default=540)
    parser.add_argument("--burn-in", type=int, default=45)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=str, default="data/raw")
    args = parser.parse_args()

    data, pharmacies, medicines = generate(
        args.pharmacies, args.days, args.burn_in, args.seed, args.medicines
    )

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    data.to_csv(out / "inventory_daily.csv", index=False)
    pharmacies.to_csv(out / "pharmacies.csv", index=False)
    medicines.to_csv(out / "medicines.csv", index=False)

    # ---- quick sanity summary ----
    pairs = data.groupby(["pharmacy_id", "medicine_id"])
    stockout_rate = data["stockout"].mean()

    # would a "stock-out in the next 3 days" label be reasonable?
    future = pairs["stockout"].transform(
        lambda s: s.shift(-1).rolling(3).max().shift(-2)
    )
    label_rate = future.dropna().mean()

    print(f"Rows: {len(data):,}")
    print(f"Pharmacy-medicine pairs: {pairs.ngroups}")
    print(f"Date range: {data['date'].min()} to {data['date'].max()}")
    print(f"Stock-out day rate: {stockout_rate:.2%}")
    print(f"Share of days with a stock-out in the next 3 days: {label_rate:.2%}")
    per_pair = pairs["stockout"].mean()
    print(
        "Per-pair stock-out rate -> min {:.1%}, median {:.1%}, max {:.1%}".format(
            per_pair.min(), per_pair.median(), per_pair.max()
        )
    )
    print(f"Saved to: {out.resolve()}")


if __name__ == "__main__":
    main()