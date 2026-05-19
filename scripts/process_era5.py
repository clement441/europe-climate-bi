"""
Pipeline A — ERA5 Climate Grid Processing
==========================================

Purpose:
    Converts raw ERA5 NetCDF reanalysis files into 12 monthly JSON files
    (one per calendar month) containing the 1991-2020 climate normals for
    temperature, precipitation, and sunshine hours across a 153×281 grid
    covering Europe at 0.25° resolution.

Inputs:
    data/raw/data_stream-moda_stepType-avgua.nc
        ERA5 monthly averages — variable: t2m (2m air temperature, Kelvin)
        Global 0.25° grid, Jan 1940 – Dec 2025, ~1.3 GB

    data/raw/data_stream-moda_stepType-avgad.nc
        ERA5 monthly accumulated fields — variables:
          tp   (total precipitation, m/day)
          ssrd (surface solar radiation downwards, J/m²)
        Global 0.25° grid, Jan 1940 – Dec 2025, ~2.6 GB

Outputs:
    data/processed/climate_normals/climate_{jan-dec}.json  (~1 MB each)
    data/processed/climate_normals/metadata.json
    web/public/data/climate_normals/*  (mirror copy for the frontend)

    Each monthly JSON structure:
        {
          "month": 7,
          "lats": [72.0, 71.75, ...],   # 153 values, 72°N to 34°N
          "lons": [-25.0, -24.75, ...], # 281 values, -25°W to 45°E
          "temperature":   [[...], ...],  # °C, null for ocean cells
          "precipitation": [[...], ...],  # mm/month
          "sunshine":      [[...], ...]   # hours/day
        }
    Arrays are indexed [lat_index][lon_index].

Run:
    python scripts/process_era5.py

Notes:
    - Requires ~8 GB RAM (xarray loads ERA5 arrays into memory for normals).
    - Takes several minutes to compute sunshine and normals.
    - ERA5 files must be present in data/raw/ (gitignored, ~4 GB combined).
      Download from the Copernicus Climate Data Store (CDS) if missing.
    - Sunshine is estimated from surface solar radiation using the vectorized
      Ångström-Prescott method (not directly measured by ERA5).
    - Ocean cells have NaN temperature and are stored as null in the JSON;
      the frontend skips them when rendering.
"""

import json
import shutil
from pathlib import Path

import numpy as np
import xarray as xr

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
RAW_AVGUA = ROOT / "data" / "raw" / "data_stream-moda_stepType-avgua.nc"
RAW_AVGAD = ROOT / "data" / "raw" / "data_stream-moda_stepType-avgad.nc"
OUTPUT_DIR = ROOT / "data" / "processed" / "climate_normals"
WEB_DIR = ROOT / "web" / "public" / "data" / "climate_normals"

MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun",
               "jul", "aug", "sep", "oct", "nov", "dec"]


# === STEP 1: LOAD ERA5 FILES =================================================

print("=" * 60, flush=True)
print("STEP 1: Loading ERA5 NetCDF files...", flush=True)

if not RAW_AVGUA.exists() or not RAW_AVGAD.exists():
    raise FileNotFoundError(
        "ERA5 raw files not found in data/raw/. "
        "Download from the Copernicus Climate Data Store (CDS)."
    )

ds_temp = xr.open_dataset(RAW_AVGUA)   # t2m: (time, lat, lon)
ds_rad  = xr.open_dataset(RAW_AVGAD)   # tp + ssrd: (time, lat, lon)

print(f"  Temperature:   {ds_temp['t2m'].shape}", flush=True)
print(f"  Precipitation: {ds_rad['tp'].shape}", flush=True)
print(f"  Solar rad:     {ds_rad['ssrd'].shape}", flush=True)


# === STEP 2: REPROJECT AND SLICE TO EUROPE ====================================

print("\nSTEP 2: Reprojecting longitude and slicing to Europe...", flush=True)

# ERA5 uses 0–360 longitude; convert to -180–180 and re-sort
ds_temp = ds_temp.assign_coords(
    longitude=(((ds_temp.longitude + 180) % 360) - 180)
).sortby("longitude")
ds_rad = ds_rad.assign_coords(
    longitude=(((ds_rad.longitude + 180) % 360) - 180)
).sortby("longitude")

# Slice to Europe: 72°N–34°N, 25°W–45°E
ds_temp_eu = ds_temp.sel(latitude=slice(72, 34), longitude=slice(-25, 45))
ds_rad_eu  = ds_rad.sel(latitude=slice(72, 34), longitude=slice(-25, 45))

n_lat = len(ds_temp_eu.latitude)
n_lon = len(ds_temp_eu.longitude)
print(f"  Grid: {n_lat} × {n_lon} cells", flush=True)


# === STEP 3: UNIT CONVERSIONS =================================================

print("\nSTEP 3: Converting units...", flush=True)

# Temperature: Kelvin → Celsius
temp_c = ds_temp_eu["t2m"] - 273.15

# Precipitation: m/day → mm/month (multiply by 1000 × days in that month)
days_in_month = ds_rad_eu["valid_time"].dt.days_in_month
precip_mm = ds_rad_eu["tp"] * 1000 * days_in_month

print("  Temperature: K → °C", flush=True)
print("  Precipitation: m/day → mm/month", flush=True)


# === STEP 4: SUNSHINE HOURS (Vectorized Ångström-Prescott) ===================

print("\nSTEP 4: Computing sunshine hours/day (Ångström-Prescott)...", flush=True)

# Build lookup tables for daylight hours and clear-sky radiation per (month, latitude).
# Uses the midpoint day-of-year for each calendar month.
mid_doy = np.array([15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349])
GSC = 1361  # Solar constant (W/m²)

lats = ds_rad_eu.latitude.values          # shape: (153,)
lat_rad = np.radians(lats)

daylight_lookup  = np.zeros((12, n_lat))
clearsky_lookup  = np.zeros((12, n_lat))

for m in range(12):
    doy  = mid_doy[m]
    decl = np.radians(23.45 * np.sin(np.radians(360 * (284 + doy) / 365)))
    dr   = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)

    cos_ws = np.clip(-np.tan(lat_rad) * np.tan(decl), -1, 1)
    ws = np.arccos(cos_ws)

    daylight_lookup[m, :] = (24 / np.pi) * ws
    clearsky_lookup[m, :] = (24 * 3600 / np.pi) * GSC * dr * (
        ws * np.sin(lat_rad) * np.sin(decl)
        + np.cos(lat_rad) * np.cos(decl) * np.sin(ws)
    )

print("  Lookup tables built.", flush=True)

# Load SSRD into memory and broadcast lookup arrays to (time, lat, lon)
print("  Loading SSRD array (~1 GB)...", flush=True)
ssrd_vals = ds_rad_eu["ssrd"].values                      # (1032, 153, 281)
month_idx = ds_rad_eu["valid_time"].dt.month.values - 1   # 0-based, shape (1032,)

dl_3d = daylight_lookup[month_idx, :][:, :, np.newaxis]   # (1032, 153, 1)
ra_3d = clearsky_lookup[month_idx, :][:, :, np.newaxis]   # (1032, 153, 1)

# Sunshine fraction = actual / (75% of clear-sky maximum); clip to [0, 1]
with np.errstate(divide="ignore", invalid="ignore"):
    fraction = np.where(ra_3d > 0, ssrd_vals / (0.75 * ra_3d), 0)
fraction = np.clip(fraction, 0, 1)

sunshine = np.clip(fraction * dl_3d, 0, 16)  # hours/day, physical max ~16

sunshine_da = xr.DataArray(
    sunshine,
    coords=ds_rad_eu["ssrd"].coords,
    dims=ds_rad_eu["ssrd"].dims,
    name="sunshine_hours",
)
print(f"  Sunshine range: {sunshine.min():.1f}–{sunshine.max():.1f} h/day", flush=True)


# === STEP 5: COMPUTE 1991-2020 CLIMATE NORMALS ================================

print("\nSTEP 5: Computing 1991-2020 climate normals...", flush=True)

# Filter to the WMO standard 30-year reference period
temp_norm    = temp_c.sel(valid_time=slice("1991-01", "2020-12"))
precip_norm  = precip_mm.sel(valid_time=slice("1991-01", "2020-12"))
sun_norm     = sunshine_da.sel(valid_time=slice("1991-01", "2020-12"))

# Group by calendar month, take the 30-year mean → shape (12, 153, 281)
temp_normals    = temp_norm.groupby("valid_time.month").mean("valid_time")
precip_normals  = precip_norm.groupby("valid_time.month").mean("valid_time")
sunshine_normals = sun_norm.groupby("valid_time.month").mean("valid_time")

print(f"  Normals shape: {temp_normals.shape}", flush=True)
print(f"  July temp range:    {float(temp_normals.sel(month=7).min()):.1f}–"
      f"{float(temp_normals.sel(month=7).max()):.1f} °C", flush=True)
print(f"  July precip range:  {float(precip_normals.sel(month=7).min()):.1f}–"
      f"{float(precip_normals.sel(month=7).max()):.1f} mm", flush=True)
print(f"  July sun range:     {float(sunshine_normals.sel(month=7).min()):.1f}–"
      f"{float(sunshine_normals.sel(month=7).max()):.1f} h/day", flush=True)


# === STEP 6: EXPORT MONTHLY JSON FILES ========================================

print("\nSTEP 6: Exporting monthly JSON files...", flush=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

lats_list = [round(float(v), 2) for v in temp_normals.latitude.values]
lons_list = [round(float(v), 2) for v in temp_normals.longitude.values]

for m in range(1, 13):
    name = MONTH_NAMES[m - 1]

    t_grid = temp_normals.sel(month=m).values
    p_grid = precip_normals.sel(month=m).values
    s_grid = sunshine_normals.sel(month=m).values

    # Replace NaN (ocean cells) with None for clean JSON output
    t_grid = np.where(np.isnan(t_grid), None, np.round(t_grid, 1))
    p_grid = np.where(np.isnan(p_grid), None, np.round(p_grid, 1))
    s_grid = np.where(np.isnan(s_grid), None, np.round(s_grid, 1))

    payload = {
        "month": m,
        "lats": lats_list,
        "lons": lons_list,
        "temperature": t_grid.tolist(),
        "precipitation": p_grid.tolist(),
        "sunshine": s_grid.tolist(),
    }

    out_path = OUTPUT_DIR / f"climate_{name}.json"
    with open(out_path, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"  ✓ {name}: {size_mb:.1f} MB", flush=True)

# metadata.json — coordinate arrays and unit definitions
meta = {
    "lats": lats_list,
    "lons": lons_list,
    "n_lat": len(lats_list),
    "n_lon": len(lons_list),
    "variables": ["temperature", "precipitation", "sunshine"],
    "units": {
        "temperature": "°C (1991-2020 monthly normal)",
        "precipitation": "mm/month (1991-2020 monthly normal)",
        "sunshine": "hours/day (1991-2020 monthly normal, Ångström-Prescott estimate)",
    },
    "baseline_period": "1991-2020",
    "months": MONTH_NAMES,
    "grid": {
        "lat_range": "72°N to 34°N",
        "lon_range": "25°W to 45°E",
        "resolution": "0.25°",
    },
}
with open(OUTPUT_DIR / "metadata.json", "w") as f:
    json.dump(meta, f, indent=2)

total_mb = sum(p.stat().st_size for p in OUTPUT_DIR.iterdir()) / (1024 * 1024)
print(f"\n  ✓ {len(list(OUTPUT_DIR.iterdir()))} files written ({total_mb:.1f} MB total)", flush=True)


# === STEP 7: COPY TO WEB PUBLIC FOLDER ========================================

print("\nSTEP 7: Copying to web/public/data/climate_normals/...", flush=True)

if WEB_DIR.parent.exists():
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    for src in OUTPUT_DIR.iterdir():
        shutil.copy2(src, WEB_DIR / src.name)
    print(f"  ✓ Copied {len(list(WEB_DIR.iterdir()))} files to {WEB_DIR}", flush=True)
else:
    print(f"  ⚠ web/public/data/ not found — skipping copy. "
          f"Copy {OUTPUT_DIR} manually.", flush=True)

print("\n✓ PIPELINE A COMPLETE!", flush=True)
