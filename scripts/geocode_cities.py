"""
Pipeline B — Step 1: Geocode Cities
=====================================

Purpose:
    Resolves latitude/longitude coordinates for every city in the
    cost-of-living dataset using the Nominatim geocoder (OpenStreetMap).
    Runs incrementally: only cities not already in cities_master.csv are
    geocoded, so re-running after adding new cities is safe and fast.

Input:
    data/raw/cost-of-living.csv
        231 European cities with cost-of-living metrics.
        Required columns: city, country.

    data/processed/cities_master.csv  (optional — created on first run)
        Previously geocoded cities. If present, only the diff is geocoded.

Output:
    data/processed/cities_master.csv
        All cities with lat/lon coordinates.
        Columns: city, country, lat, lon
        Cities that Nominatim cannot resolve are stored with null lat/lon
        (currently: Pristina, Kosovo (Disputed Territory)).

Run:
    python scripts/geocode_cities.py

Notes:
    - Nominatim's usage policy requires a 1-second pause between requests.
      First run geocodes all 231 cities and takes ~4 minutes.
    - Subsequent runs with no new cities finish in under a second.
    - Must be run before fetch_projections.py and build_city_dataset.py.
"""

import os
import time
from pathlib import Path

import pandas as pd
from geopy.geocoders import Nominatim

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
RAW_COSTS  = ROOT / "data" / "raw" / "cost-of-living.csv"
MASTER_CSV = ROOT / "data" / "processed" / "cities_master.csv"


# === STEP 1: LOAD COST-OF-LIVING DATA =========================================

print("=" * 60, flush=True)
print("STEP 1: Loading cost-of-living data...", flush=True)

costs = pd.read_csv(RAW_COSTS)
# Source CSV has leading/trailing whitespace in city and country columns
costs["city"]    = costs["city"].str.strip()
costs["country"] = costs["country"].str.strip()
print(f"  {len(costs)} cities in source file", flush=True)


# === STEP 2: FIND CITIES THAT NEED GEOCODING ==================================

print("\nSTEP 2: Checking against existing master file...", flush=True)

if MASTER_CSV.exists():
    existing = pd.read_csv(MASTER_CSV)
    existing_cities = set(zip(existing["city"], existing["country"]))
    new_rows = costs[
        ~costs.apply(lambda r: (r["city"], r["country"]) in existing_cities, axis=1)
    ]
    print(f"  Existing cities: {len(existing)}", flush=True)
    print(f"  New cities to geocode: {len(new_rows)}", flush=True)
else:
    existing = pd.DataFrame(columns=["city", "country", "lat", "lon"])
    new_rows = costs
    print(f"  No existing master file. Geocoding all {len(new_rows)} cities.", flush=True)


# === STEP 3: GEOCODE NEW CITIES ===============================================

if len(new_rows) > 0:
    print("\nSTEP 3: Geocoding new cities via Nominatim...", flush=True)

    geolocator = Nominatim(user_agent="europe-climate-bi/1.0 (github.com/clement441/europe-climate-bi)")
    new_coords = []

    for i, row in new_rows.iterrows():
        try:
            location = geolocator.geocode(f"{row['city']}, {row['country']}")
            if location:
                new_coords.append({
                    "city":    row["city"],
                    "country": row["country"],
                    "lat":     round(location.latitude, 4),
                    "lon":     round(location.longitude, 4),
                })
                print(f"  ✓ {row['city']} → {location.latitude:.4f}, {location.longitude:.4f}",
                      flush=True)
            else:
                new_coords.append({
                    "city": row["city"], "country": row["country"],
                    "lat": None, "lon": None,
                })
                print(f"  ✗ {row['city']} → NOT FOUND", flush=True)
            time.sleep(1)  # Nominatim requires 1 s between requests
        except Exception as e:
            print(f"  ✗ {row['city']} → ERROR: {e}", flush=True)
            new_coords.append({
                "city": row["city"], "country": row["country"],
                "lat": None, "lon": None,
            })
            time.sleep(1)

    new_df = pd.DataFrame(new_coords)
    master = (
        pd.concat([existing, new_df], ignore_index=True)
        .drop_duplicates(subset=["city", "country"])
    )
else:
    print("\nSTEP 3: No new cities to geocode.", flush=True)
    master = existing.copy()


# === STEP 4: SAVE ============================================================

print("\nSTEP 4: Saving cities_master.csv...", flush=True)

MASTER_CSV.parent.mkdir(parents=True, exist_ok=True)
master.to_csv(MASTER_CSV, index=False)

missing = master[master["lat"].isna()]
print(f"  ✓ {len(master)} cities saved to {MASTER_CSV}", flush=True)
if len(missing) > 0:
    print(f"  ⚠ {len(missing)} city/cities with null coordinates:", flush=True)
    for _, row in missing.iterrows():
        print(f"      {row['city']}, {row['country']}", flush=True)

print("\n✓ GEOCODING COMPLETE!", flush=True)
