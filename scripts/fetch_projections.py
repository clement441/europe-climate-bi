"""
Pipeline B — Step 2: Fetch Climate Projections
===============================================

Purpose:
    Fetches daily climate data (1991-2050) from the Open-Meteo Climate API
    for all geocoded cities, averages across four global climate models
    (GCM ensemble), and computes four climate-change delta metrics per city.
    Runs incrementally: only cities not already in climate_projections.csv
    are fetched, so re-running after adding new cities is safe.

Input:
    data/processed/cities_master.csv
        Must exist — run geocode_cities.py first.
        Cities with null lat/lon (Pristina) are skipped.

    data/processed/climate_projections.csv  (optional — created on first run)
        Previously computed projections. If present, only the diff is fetched.

Output:
    data/processed/climate_projections.csv
        One row per city with 8 numeric fields:
            city, country, lat, lon,
            baseline_temp_c, future_temp_c,
            delta_temp_c          — future annual mean temp minus baseline (°C)
            delta_summer_temp_c   — same, restricted to June-July-August (°C)
            delta_precip_pct      — % change in annual precipitation total
            baseline_heat_days    — mean days/year with daily max > 35°C (baseline)
            future_heat_days      — same for future period
            delta_heat_days       — change in extreme-heat days/year

        Baseline period: 1991-2020 (WMO standard)
        Future period:   2040-2050

Run:
    python scripts/fetch_projections.py

Notes:
    - First run fetches all 230 cities and takes 10-30 minutes depending on
      API response time.
    - Subsequent runs with no new cities finish instantly.
    - The four GCMs used: CMCC_CM2_VHR4, EC_Earth3P_HR, MPI_ESM1_2_XR,
      MRI_AGCM3_2_S. The API returns responses ordered as:
        [city_1_model_1, city_1_model_2, ..., city_1_model_4, city_2_model_1, ...]
    - HTTP responses are cached for 24 hours in data/cache/openmeteo.sqlite
      to allow re-running without re-fetching.
    - Must be run before build_city_dataset.py.
"""

from pathlib import Path

import numpy as np
import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT            = Path(__file__).parent.parent
MASTER_CSV      = ROOT / "data" / "processed" / "cities_master.csv"
PROJECTIONS_CSV = ROOT / "data" / "processed" / "climate_projections.csv"
CACHE_DIR       = ROOT / "data" / "cache"

MODELS    = ["CMCC_CM2_VHR4", "EC_Earth3P_HR", "MPI_ESM1_2_XR", "MRI_AGCM3_2_S"]
N_MODELS  = len(MODELS)
API_URL   = "https://climate-api.open-meteo.com/v1/climate"


# === STEP 1: LOAD MASTER CITY LIST ============================================

print("=" * 60, flush=True)
print("STEP 1: Loading master city list...", flush=True)

if not MASTER_CSV.exists():
    raise FileNotFoundError(
        f"{MASTER_CSV} not found. Run geocode_cities.py first."
    )

master = pd.read_csv(MASTER_CSV)
cities_with_coords = master.dropna(subset=["lat", "lon"])
print(f"  Total cities: {len(master)}", flush=True)
print(f"  Cities with coordinates: {len(cities_with_coords)}", flush=True)


# === STEP 2: FIND CITIES THAT NEED PROJECTIONS ================================

print("\nSTEP 2: Checking against existing projections...", flush=True)

if PROJECTIONS_CSV.exists():
    existing_proj = pd.read_csv(PROJECTIONS_CSV)
    existing_cities = set(zip(existing_proj["city"], existing_proj["country"]))
    cities_needed = cities_with_coords[
        ~cities_with_coords.apply(
            lambda r: (r["city"], r["country"]) in existing_cities, axis=1
        )
    ]
    print(f"  Existing projections: {len(existing_proj)} cities", flush=True)
    print(f"  Cities needing projections: {len(cities_needed)}", flush=True)
else:
    existing_proj = pd.DataFrame()
    cities_needed = cities_with_coords
    print(f"  No existing projections. Fetching all {len(cities_needed)} cities.", flush=True)

if len(cities_needed) == 0:
    print("\nAll cities already have projections. Nothing to do.", flush=True)
    print("\n✓ PROJECTION FETCH COMPLETE (no-op)!", flush=True)
    raise SystemExit(0)


# === STEP 3: FETCH FROM OPEN-METEO CLIMATE API ================================

print(f"\nSTEP 3: Fetching from Open-Meteo Climate API...", flush=True)
print(f"  {len(cities_needed)} cities × {N_MODELS} models", flush=True)

CACHE_DIR.mkdir(parents=True, exist_ok=True)
cache_session  = requests_cache.CachedSession(
    str(CACHE_DIR / "openmeteo"), expire_after=86400
)
retry_session  = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo      = openmeteo_requests.Client(session=retry_session)

params = {
    "latitude":   cities_needed["lat"].tolist(),
    "longitude":  cities_needed["lon"].tolist(),
    "start_date": "1991-01-01",
    "end_date":   "2050-12-31",
    "models":     MODELS,
    "daily": ["temperature_2m_mean", "temperature_2m_max", "precipitation_sum"],
}

responses = openmeteo.weather_api(API_URL, params=params)
print(f"  Received {len(responses)} responses", flush=True)


# === STEP 4: COMPUTE ENSEMBLE MEAN AND CLIMATE DELTAS ========================

print("\nSTEP 4: Computing ensemble means and climate deltas...", flush=True)

expected = len(cities_needed) * N_MODELS
if len(responses) != expected:
    raise ValueError(
        f"Expected {expected} responses ({len(cities_needed)} cities × {N_MODELS} models), "
        f"got {len(responses)}. Aborting — partial results would corrupt ensemble means."
    )

def compute_city_projections(city_responses, row):
    model_dfs = []
    for response in city_responses:
        daily = response.Daily()
        df = pd.DataFrame({
            "date": pd.date_range(
                start=pd.to_datetime(daily.Time(), unit="s", utc=True),
                end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
                freq=pd.Timedelta(seconds=daily.Interval()),
                inclusive="left",
            ),
            "temperature_2m_mean": daily.Variables(0).ValuesAsNumpy(),
            "temperature_2m_max":  daily.Variables(1).ValuesAsNumpy(),
            "precipitation_sum":   daily.Variables(2).ValuesAsNumpy(),
        })
        model_dfs.append(df)

    ensemble_mean = (
        pd.concat(model_dfs)
        .groupby("date")
        .agg({
            "temperature_2m_mean": "mean",
            "temperature_2m_max":  "mean",
            "precipitation_sum":   "mean",
        })
        .reset_index()
    )
    ensemble_mean["year"]  = ensemble_mean["date"].dt.year
    ensemble_mean["month"] = ensemble_mean["date"].dt.month

    baseline = ensemble_mean[ensemble_mean["year"].between(1991, 2020)]
    future   = ensemble_mean[ensemble_mean["year"].between(2040, 2050)]

    baseline_temp = baseline["temperature_2m_mean"].mean()
    future_temp   = future["temperature_2m_mean"].mean()
    delta_temp    = future_temp - baseline_temp

    baseline_summer = baseline[baseline["month"].isin([6, 7, 8])]["temperature_2m_mean"].mean()
    future_summer   = future[future["month"].isin([6, 7, 8])]["temperature_2m_mean"].mean()
    delta_summer    = future_summer - baseline_summer

    baseline_precip  = baseline.groupby("year")["precipitation_sum"].sum().mean()
    future_precip    = future.groupby("year")["precipitation_sum"].sum().mean()
    delta_precip_pct = ((future_precip - baseline_precip) / baseline_precip) * 100

    baseline_heat = baseline[baseline["temperature_2m_max"] > 35].groupby("year").size().mean()
    future_heat   = future[future["temperature_2m_max"] > 35].groupby("year").size().mean()
    # NaN means zero heat days in the period (no days above threshold)
    if np.isnan(baseline_heat): baseline_heat = 0.0
    if np.isnan(future_heat):   future_heat   = 0.0
    delta_heat_days = future_heat - baseline_heat

    return {
        "city":                row["city"],
        "country":             row["country"],
        "lat":                 row["lat"],
        "lon":                 row["lon"],
        "baseline_temp_c":     round(baseline_temp, 1),
        "future_temp_c":       round(future_temp, 1),
        "delta_temp_c":        round(delta_temp, 1),
        "delta_summer_temp_c": round(delta_summer, 1),
        "delta_precip_pct":    round(delta_precip_pct, 1),
        "baseline_heat_days":  round(baseline_heat, 1),
        "future_heat_days":    round(future_heat, 1),
        "delta_heat_days":     round(delta_heat_days, 1),
    }


new_results = []

for city_idx in range(len(cities_needed)):
    row = cities_needed.iloc[city_idx]
    city_responses = responses[city_idx * N_MODELS: (city_idx + 1) * N_MODELS]

    try:
        result = compute_city_projections(city_responses, row)
        new_results.append(result)
        print(
            f"  ✓ {city_idx + 1}/{len(cities_needed)} {row['city']}: "
            f"ΔT={result['delta_temp_c']:+.1f}°C, ΔP={result['delta_precip_pct']:+.1f}%, "
            f"ΔHeat={result['delta_heat_days']:+.1f} days",
            flush=True,
        )

    except Exception as e:
        print(f"  ✗ {row['city']}: ERROR — {e}", flush=True)


# === STEP 5: SAVE ============================================================

print("\nSTEP 5: Saving climate_projections.csv...", flush=True)

new_df = pd.DataFrame(new_results)
all_proj = (
    pd.concat([existing_proj, new_df], ignore_index=True)
    .drop_duplicates(subset=["city", "country"])
)

PROJECTIONS_CSV.parent.mkdir(parents=True, exist_ok=True)
all_proj.to_csv(PROJECTIONS_CSV, index=False)

print(f"  ✓ {len(all_proj)} cities saved to {PROJECTIONS_CSV}", flush=True)
print("\n✓ PROJECTION FETCH COMPLETE!", flush=True)
