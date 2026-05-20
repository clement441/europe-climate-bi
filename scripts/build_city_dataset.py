"""
Pipeline B — Step 3: Build City Dataset
=========================================

Purpose:
    Merges cost-of-living data, geocoordinates, and climate projections into
    a single JSON file for the frontend. Computes a relative resilience score
    and risk tier for each city based on its four climate-change deltas.

    Safe to re-run at any time — no API calls. Re-run this script alone if
    you change the resilience formula or cost-of-living source data.

Inputs:
    data/raw/cost-of-living.csv
        231 cities with Numbeo cost-of-living metrics.

    data/processed/cities_master.csv
        City geocoordinates (run geocode_cities.py first).

    data/processed/climate_projections.csv
        Climate-change deltas per city (run fetch_projections.py first).

Outputs:
    data/processed/cities_all.json      (~140 KB, compact JSON, no whitespace)
    web/public/data/cities_all.json     (mirror copy for the frontend)

    Each city object contains:
        Identity:    city, country, lat, lon
        Cost:        rank-one-bedroom, cost-of-living-index, one-bedroom-city-rent,
                     monthly-public-transport-pass, three-bedroom-city-rent,
                     meal-restaurant, cinema-ticket, price-square-meter-buy,
                     basic-utilities-85m2-apartment, 1l-milk, chicken, bread, rice
        Climate:     baseline_temp_c, future_temp_c,
                     delta_temp_c, delta_summer_temp_c,
                     delta_precip_pct,
                     baseline_heat_days, future_heat_days, delta_heat_days
        Resilience:  resilience_score (0-100), risk_tier

Run:
    python scripts/build_city_dataset.py

Resilience score methodology:
    1. Min-max normalize each of the 4 deltas to a 0-100 vulnerability sub-score
       (0 = least vulnerable city in dataset, 100 = most vulnerable).
       Precipitation uses |delta_precip_pct| — both drying and flooding are bad.
    2. Equal-weight average of the 4 sub-scores → vulnerability (0-100).
    3. Invert: resilience_score = 100 − vulnerability.
    Scores are relative across the full dataset, not absolute.

Risk tier thresholds:
    resilience_score >= 75  → Low Risk
    resilience_score >= 50  → Moderate Risk
    resilience_score >= 25  → High Risk
    resilience_score <  25  → Critical
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT            = Path(__file__).parent.parent
RAW_COSTS       = ROOT / "data" / "raw" / "cost-of-living.csv"
MASTER_CSV      = ROOT / "data" / "processed" / "cities_master.csv"
PROJECTIONS_CSV = ROOT / "data" / "processed" / "climate_projections.csv"
OUTPUT_JSON     = ROOT / "data" / "processed" / "cities_all.json"
WEB_OUTPUT      = ROOT / "web" / "public" / "data" / "cities_all.json"


# === STEP 1: LOAD ALL INPUTS ==================================================

print("=" * 60, flush=True)
print("STEP 1: Loading input files...", flush=True)

for path in [RAW_COSTS, MASTER_CSV, PROJECTIONS_CSV]:
    if not path.exists():
        script = {
            MASTER_CSV:      "geocode_cities.py",
            PROJECTIONS_CSV: "fetch_projections.py",
        }.get(path, "")
        hint = f" Run {script} first." if script else ""
        raise FileNotFoundError(f"{path} not found.{hint}")

costs       = pd.read_csv(RAW_COSTS)
costs["city"]    = costs["city"].str.strip()
costs["country"] = costs["country"].str.strip()

master      = pd.read_csv(MASTER_CSV)
projections = pd.read_csv(PROJECTIONS_CSV)

print(f"  Cost-of-living:  {len(costs)} cities", flush=True)
print(f"  Master (coords): {len(master)} cities", flush=True)
print(f"  Projections:     {len(projections)} cities", flush=True)


# === STEP 2: COMPUTE RESILIENCE SCORES ========================================

print("\nSTEP 2: Computing resilience scores...", flush=True)

df = projections.copy()

def minmax(series):
    lo, hi = series.min(), series.max()
    return (series - lo) / (hi - lo) * 100 if hi > lo else series * 0

# Vulnerability sub-scores: 0 = least vulnerable, 100 = most vulnerable
df["temp_score"]    = minmax(df["delta_temp_c"])
df["summer_score"]  = minmax(df["delta_summer_temp_c"])
df["precip_score"]  = minmax(df["delta_precip_pct"].abs())  # both drying and flooding are bad
df["heat_score"]    = minmax(df["delta_heat_days"])

df["vulnerability"]     = (df["temp_score"] + df["summer_score"]
                            + df["precip_score"] + df["heat_score"]) / 4
df["resilience_score"]  = (100 - df["vulnerability"]).round(1)

def risk_tier(score):
    if score >= 75: return "Low Risk"
    if score >= 50: return "Moderate Risk"
    if score >= 25: return "High Risk"
    return "Critical"

df["risk_tier"] = df["resilience_score"].apply(risk_tier)

cols_to_save = [
    "city", "country", "lat", "lon",
    "baseline_temp_c", "future_temp_c",
    "delta_temp_c", "delta_summer_temp_c", "delta_precip_pct",
    "baseline_heat_days", "future_heat_days", "delta_heat_days",
    "resilience_score", "risk_tier",
]

print(f"  Score range: {df['resilience_score'].min()} – {df['resilience_score'].max()}", flush=True)
print(f"  Distribution:", flush=True)
for tier, count in df["risk_tier"].value_counts().items():
    print(f"    {tier}: {count}", flush=True)
print(f"\n  Most resilient:  {df.nlargest(1, 'resilience_score').iloc[0]['city']} "
      f"({df['resilience_score'].max()})", flush=True)
print(f"  Most vulnerable: {df.nsmallest(1, 'resilience_score').iloc[0]['city']} "
      f"({df['resilience_score'].min()})", flush=True)


# === STEP 3: MERGE ALL DATA ===================================================

print("\nSTEP 3: Merging datasets...", flush=True)

merged = master.merge(costs, on=["city", "country"], how="left")

proj_cols = df[cols_to_save].drop(columns=["lat", "lon"])
merged = merged.merge(proj_cols, on=["city", "country"], how="left")

# Replace NaN with None for clean JSON serialisation
merged = merged.where(merged.notna(), None)

# Round all numeric columns to 2 decimal places
for col in merged.select_dtypes(include=[np.number]).columns:
    merged[col] = merged[col].apply(lambda x: round(x, 2) if x is not None else None)

print(f"  Merged: {len(merged)} cities, {len(merged.columns)} columns", flush=True)


# === STEP 4: EXPORT JSON ======================================================

print("\nSTEP 4: Exporting cities_all.json...", flush=True)

records = merged.to_dict(orient="records")
OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

with open(OUTPUT_JSON, "w") as f:
    json.dump(records, f, separators=(",", ":"))

size_mb = OUTPUT_JSON.stat().st_size / (1024 * 1024)
print(f"  ✓ {len(records)} cities → {OUTPUT_JSON} ({size_mb:.2f} MB)", flush=True)

# Mirror to web/public/data/
if WEB_OUTPUT.parent.exists():
    with open(WEB_OUTPUT, "w") as f:
        json.dump(records, f, separators=(",", ":"))
    print(f"  ✓ Copied to {WEB_OUTPUT}", flush=True)
else:
    print(f"  ⚠ {WEB_OUTPUT.parent} not found — skipping web copy.", flush=True)

print("\n✓ PIPELINE B COMPLETE!", flush=True)
