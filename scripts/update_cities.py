import pandas as pd
import numpy as np
from geopy.geocoders import Nominatim
import openmeteo_requests
import requests_cache
from retry_requests import retry
import time
import json
import os

# ============================================================
# CONFIG — edit these paths if needed
# ============================================================
RAW_COSTS = r'..\data\raw\cost-of-living.csv'
MASTER_CSV = r'..\data\processed\cities_master.csv'
PROJECTIONS_CSV = r'..\data\processed\climate_projections.csv'
OUTPUT_JSON = r'..\data\processed\cities_all.json'
WEB_OUTPUT = r'..\web\public\data\cities_all.json'

# ============================================================
# STEP 1: Check for new/updated cities
# ============================================================
print("=" * 50, flush=True)
print("STEP 1: Checking for new cities...", flush=True)

costs = pd.read_csv(RAW_COSTS)
# Source CSV has rows like "Zurich, Switzerland" where country is parsed with a
# leading space. Strip both columns so the space doesn't propagate to the JSON.
costs['city'] = costs['city'].str.strip()
costs['country'] = costs['country'].str.strip()

# Load existing master if it exists
if os.path.exists(MASTER_CSV):
    existing = pd.read_csv(MASTER_CSV)
    existing_cities = set(zip(existing['city'], existing['country']))
    new_rows = costs[~costs.apply(lambda r: (r['city'], r['country']) in existing_cities, axis=1)]
    print(f"Existing cities: {len(existing)}", flush=True)
    print(f"New cities to geocode: {len(new_rows)}", flush=True)
else:
    existing = pd.DataFrame(columns=['city', 'country', 'lat', 'lon'])
    new_rows = costs
    print(f"No existing master file. Geocoding all {len(new_rows)} cities.", flush=True)

# ============================================================
# STEP 2: Geocode only new cities
# ============================================================
if len(new_rows) > 0:
    print("\nSTEP 2: Geocoding new cities...", flush=True)
    geolocator = Nominatim(user_agent="europe-climate-bi/1.0 (clement@datasaku.com)")
    new_coords = []

    for i, row in new_rows.iterrows():
        try:
            location = geolocator.geocode(f"{row['city']}, {row['country']}")
            if location:
                new_coords.append({
                    "city": row["city"],
                    "country": row["country"],
                    "lat": round(location.latitude, 4),
                    "lon": round(location.longitude, 4)
                })
                print(f"  ✓ {row['city']} → {location.latitude:.4f}, {location.longitude:.4f}", flush=True)
            else:
                new_coords.append({"city": row["city"], "country": row["country"],
                                  "lat": None, "lon": None})
                print(f"  ✗ {row['city']} → NOT FOUND", flush=True)
            time.sleep(1)
        except Exception as e:
            print(f"  ✗ {row['city']} → ERROR: {e}", flush=True)
            new_coords.append({"city": row["city"], "country": row["country"],
                              "lat": None, "lon": None})
            time.sleep(1)

    new_df = pd.DataFrame(new_coords)
    master = pd.concat([existing, new_df], ignore_index=True).drop_duplicates(subset=['city', 'country'])
else:
    print("\nSTEP 2: No new cities to geocode.", flush=True)
    master = existing.copy()

master.to_csv(MASTER_CSV, index=False)
print(f"Master city list: {len(master)} cities", flush=True)

# ============================================================
# STEP 3: Fetch projections only for cities that don't have them
# ============================================================
print("\n" + "=" * 50, flush=True)
print("STEP 3: Checking climate projections...", flush=True)

cities_with_coords = master.dropna(subset=['lat', 'lon'])

if os.path.exists(PROJECTIONS_CSV):
    existing_proj = pd.read_csv(PROJECTIONS_CSV)
    existing_proj_cities = set(zip(existing_proj['city'], existing_proj['country']))
    cities_needing_proj = cities_with_coords[
        ~cities_with_coords.apply(lambda r: (r['city'], r['country']) in existing_proj_cities, axis=1)
    ]
    print(f"Existing projections: {len(existing_proj)} cities", flush=True)
    print(f"Cities needing projections: {len(cities_needing_proj)}", flush=True)
else:
    existing_proj = pd.DataFrame()
    cities_needing_proj = cities_with_coords
    print(f"No existing projections. Fetching all {len(cities_needing_proj)} cities.", flush=True)

if len(cities_needing_proj) > 0:
    print("\nFetching from Open-Meteo Climate API...", flush=True)

    cache_session = requests_cache.CachedSession('.cache', expire_after=86400)
    retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
    openmeteo = openmeteo_requests.Client(session=retry_session)

    url = "https://climate-api.open-meteo.com/v1/climate"
    models = ["CMCC_CM2_VHR4", "EC_Earth3P_HR", "MPI_ESM1_2_XR", "MRI_AGCM3_2_S"]
    n_models = len(models)

    # Batch request
    params = {
        "latitude": cities_needing_proj["lat"].tolist(),
        "longitude": cities_needing_proj["lon"].tolist(),
        "start_date": "1991-01-01",
        "end_date": "2050-12-31",
        "models": models,
        "daily": ["temperature_2m_mean", "temperature_2m_max", "precipitation_sum"],
    }

    responses = openmeteo.weather_api(url, params=params)
    print(f"Received {len(responses)} responses", flush=True)

    new_results = []
    for city_idx in range(len(cities_needing_proj)):
        row = cities_needing_proj.iloc[city_idx]
        city_responses = responses[city_idx * n_models: (city_idx + 1) * n_models]

        try:
            model_dfs = []
            for response in city_responses:
                daily = response.Daily()
                df = pd.DataFrame({
                    "date": pd.date_range(
                        start=pd.to_datetime(daily.Time(), unit="s", utc=True),
                        end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
                        freq=pd.Timedelta(seconds=daily.Interval()),
                        inclusive="left"
                    ),
                    "temperature_2m_mean": daily.Variables(0).ValuesAsNumpy(),
                    "temperature_2m_max": daily.Variables(1).ValuesAsNumpy(),
                    "precipitation_sum": daily.Variables(2).ValuesAsNumpy(),
                })
                model_dfs.append(df)

            ensemble = pd.concat(model_dfs)
            ensemble_mean = ensemble.groupby("date").agg({
                "temperature_2m_mean": "mean",
                "temperature_2m_max": "mean",
                "precipitation_sum": "mean"
            }).reset_index()

            ensemble_mean["month"] = ensemble_mean["date"].dt.month
            ensemble_mean["year"] = ensemble_mean["date"].dt.year

            baseline = ensemble_mean[(ensemble_mean["year"] >= 1991) & (ensemble_mean["year"] <= 2020)]
            future = ensemble_mean[(ensemble_mean["year"] >= 2040) & (ensemble_mean["year"] <= 2050)]

            baseline_temp = baseline["temperature_2m_mean"].mean()
            future_temp = future["temperature_2m_mean"].mean()
            delta_temp = future_temp - baseline_temp

            baseline_summer = baseline[baseline["month"].isin([6, 7, 8])]["temperature_2m_mean"].mean()
            future_summer = future[future["month"].isin([6, 7, 8])]["temperature_2m_mean"].mean()
            delta_summer = future_summer - baseline_summer

            baseline_precip = baseline.groupby("year")["precipitation_sum"].sum().mean()
            future_precip = future.groupby("year")["precipitation_sum"].sum().mean()
            delta_precip_pct = ((future_precip - baseline_precip) / baseline_precip) * 100

            baseline_heat = baseline[baseline["temperature_2m_max"] > 35].groupby("year").size().mean()
            future_heat = future[future["temperature_2m_max"] > 35].groupby("year").size().mean()
            if np.isnan(baseline_heat): baseline_heat = 0
            if np.isnan(future_heat): future_heat = 0
            delta_heat_days = future_heat - baseline_heat

            new_results.append({
                "city": row["city"], "country": row["country"],
                "lat": row["lat"], "lon": row["lon"],
                "baseline_temp_c": round(baseline_temp, 1),
                "future_temp_c": round(future_temp, 1),
                "delta_temp_c": round(delta_temp, 1),
                "delta_summer_temp_c": round(delta_summer, 1),
                "delta_precip_pct": round(delta_precip_pct, 1),
                "baseline_heat_days": round(baseline_heat, 1),
                "future_heat_days": round(future_heat, 1),
                "delta_heat_days": round(delta_heat_days, 1),
            })
            print(f"  ✓ {row['city']}: ΔT={delta_temp:+.1f}°C", flush=True)

        except Exception as e:
            print(f"  ✗ {row['city']}: ERROR - {e}", flush=True)

    new_proj_df = pd.DataFrame(new_results)
    all_proj = pd.concat([existing_proj, new_proj_df], ignore_index=True).drop_duplicates(subset=['city', 'country'])
else:
    print("No new projections needed.", flush=True)
    all_proj = existing_proj.copy()

# ============================================================
# STEP 4: Compute resilience score for ALL cities
# ============================================================
print("\n" + "=" * 50, flush=True)
print("STEP 4: Computing resilience scores...", flush=True)

df = all_proj.copy()

df['temp_score'] = (df['delta_temp_c'] - df['delta_temp_c'].min()) / \
                   (df['delta_temp_c'].max() - df['delta_temp_c'].min()) * 100
df['summer_score'] = (df['delta_summer_temp_c'] - df['delta_summer_temp_c'].min()) / \
                     (df['delta_summer_temp_c'].max() - df['delta_summer_temp_c'].min()) * 100
df['precip_severity'] = df['delta_precip_pct'].abs()
df['precip_score'] = (df['precip_severity'] - df['precip_severity'].min()) / \
                     (df['precip_severity'].max() - df['precip_severity'].min()) * 100
df['heat_score'] = (df['delta_heat_days'] - df['delta_heat_days'].min()) / \
                   (df['delta_heat_days'].max() - df['delta_heat_days'].min()) * 100

weights = {'temp_score': 0.25, 'summer_score': 0.25, 'precip_score': 0.25, 'heat_score': 0.25}
df['vulnerability'] = sum(df[k] * v for k, v in weights.items())
df['resilience_score'] = round(100 - df['vulnerability'], 1)
df['risk_tier'] = df['resilience_score'].apply(
    lambda s: 'Low Risk' if s >= 75 else 'Moderate Risk' if s >= 50 else 'High Risk' if s >= 25 else 'Critical'
)

cols_to_save = ['city', 'country', 'lat', 'lon', 'baseline_temp_c', 'future_temp_c',
                'delta_temp_c', 'delta_summer_temp_c', 'delta_precip_pct',
                'baseline_heat_days', 'future_heat_days', 'delta_heat_days',
                'resilience_score', 'risk_tier']
df[cols_to_save].to_csv(PROJECTIONS_CSV, index=False)

print(f"Resilience scores computed for {len(df)} cities", flush=True)
print(df['risk_tier'].value_counts().to_string(), flush=True)

# ============================================================
# STEP 5: Merge everything and export JSON
# ============================================================
print("\n" + "=" * 50, flush=True)
print("STEP 5: Merging and exporting...", flush=True)

merged = master.copy()
merged = merged.merge(costs, on=['city', 'country'], how='left')
proj_cols = df[cols_to_save].drop(columns=['lat', 'lon'])
merged = merged.merge(proj_cols, on=['city', 'country'], how='left')
merged = merged.where(merged.notna(), None)

numeric_cols = merged.select_dtypes(include=[np.number]).columns
for col in numeric_cols:
    merged[col] = merged[col].apply(lambda x: round(x, 2) if x is not None else None)

records = merged.to_dict(orient='records')

with open(OUTPUT_JSON, 'w') as f:
    json.dump(records, f, separators=(',', ':'))

# Also copy to web folder
if os.path.exists(os.path.dirname(WEB_OUTPUT)):
    with open(WEB_OUTPUT, 'w') as f:
        json.dump(records, f, separators=(',', ':'))
    print(f"✓ Also copied to {WEB_OUTPUT}", flush=True)

size_mb = os.path.getsize(OUTPUT_JSON) / (1024 * 1024)
print(f"\n✓ Exported {len(records)} cities to cities_all.json ({size_mb:.2f} MB)", flush=True)
print("\n✓ PIPELINE COMPLETE!", flush=True)