# Data Pipeline — European Climate & Living Costs BI Dashboard

## Reality Check

`CLAUDE.md` describes a numbered script pipeline (`scripts/01_download_era5.py` through
`scripts/06_export_for_frontend.py`, plus `scripts/utils.py`). **All seven of those files
are 0-byte empty stubs.** They document intent, not working code.

The actual pipeline lives in two places:

| What | Where | Runs |
|---|---|---|
| Climate grid (Pipeline A) | `notebooks/01_explore_era5.ipynb`, cells `e14e06f0` + `f4341475` | Manually in Jupyter |
| City data — one-shot (Pipeline B) | Same notebook, cells `d43112f4`, `536efda9`, `32092064` | Manually in Jupyter |
| City data — incremental (Pipeline B) | `scripts/update_cities.py` | `python scripts/update_cities.py` |

The two pipelines are **entirely independent**. They share no intermediate data. They converge
only at the destination folder `web/public/data/`.

---

## Pipeline A — Climate Grid (Heatmap Layer)

### What it produces

12 monthly JSON files (`climate_jan.json` through `climate_dec.json`) plus `metadata.json`.
Each file contains the 1991-2020 climate normal for one calendar month across a 153 x 281
grid covering Europe at 0.25-degree resolution.

### Inputs

| File | Variable | Raw units | Location |
|---|---|---|---|
| `data_stream-moda_stepType-avgua.nc` | `t2m` — 2 m air temperature | Kelvin | `data/raw/` |
| `data_stream-moda_stepType-avgad.nc` | `tp` — total precipitation | m/day | `data/raw/` |
| `data_stream-moda_stepType-avgad.nc` | `ssrd` — surface solar radiation | J/m² | `data/raw/` |

Both files are ERA5 monthly reanalysis data (ECMWF Reanalysis v5 — a globally gridded
historical climate dataset). Coverage: global 0.25-degree grid (721 x 1440 cells),
January 1940 through December 2025 (1,032 timesteps). Combined size: ~4.2 GB. Gitignored.

### Processing steps

**Notebook cell `e14e06f0` — load, reproject, slice, convert, derive sunshine**

1. **Load** both NetCDF files with `xarray`.
2. **Reproject longitude** from 0-360 to -180-180 and re-sort.
3. **Slice to Europe**: latitude 72 N to 34 N, longitude -25 W to 45 E.
   Result: 153 x 281 grid (~43,000 cells).
4. **Temperature conversion**: subtract 273.15 to get degrees Celsius.
5. **Precipitation conversion**: multiply raw m/day by 1,000 (to mm) and by days in that
   calendar month to get mm/month.
6. **Sunshine derivation** (Angstrom-Prescott method):
   - Build a lookup table of theoretical clear-sky radiation (`Ra`) and maximum possible
     daylight hours for each (latitude, month) combination using solar geometry formulas.
   - Compute the ratio of actual incoming radiation (`ssrd`) to 75% of `Ra` to get the
     fraction of potential sunshine realized.
   - Multiply fraction by maximum daylight hours to get sunshine hours/day.
   - Clip to the range [0, 16] hours.

**Notebook cell `e14e06f0` (continued) — climate normals**

7. **Filter to 1991-2020** (the WMO standard 30-year reference period).
8. **Group by calendar month** and take the mean across all 30 years.
   Output: three arrays each of shape (12, 153, 281) — one per variable.

**Notebook cell `f4341475` — export**

9. Loop over the 12 months. For each month, extract the three 153 x 281 grids, replace
   NaN with `null`, round to one decimal place, and write to:
   `data/processed/climate_normals/climate_{month}.json`
10. Write `data/processed/climate_normals/metadata.json` with the coordinate arrays and
    unit definitions.

### Outputs

```
data/processed/climate_normals/
    climate_jan.json   (~1.0 MB)
    climate_feb.json   (~1.0 MB)
    ...
    climate_dec.json   (~1.1 MB)
    metadata.json      (~5 KB)
```

Each monthly file structure:
```json
{
  "month": 7,
  "lats": [72.0, 71.75, ...],
  "lons": [-25.0, -24.75, ...],
  "temperature": [[...], [...], ...],
  "precipitation": [[...], [...], ...],
  "sunshine": [[...], [...], ...]
}
```

Arrays are indexed `[lat_index][lon_index]`. Ocean cells (no ERA5 land temperature) appear
as `null` and are skipped by the frontend renderer.

---

## Pipeline B — City Data (Bubble Layer)

### What it produces

A single JSON file (`cities_all.json`) with 231 European cities, each containing cost-of-living
metrics, geocoordinates, climate change projections (2040-2050 vs 1991-2020 baseline), and a
resilience score.

### Input

`data/raw/cost-of-living.csv` — 231 cities sourced from Numbeo, with columns including
`city`, `country`, `cost-of-living-index`, `one-bedroom-city-rent`, `meal-restaurant`,
and other price metrics.

### Processing steps

**Step 1 — Geocode cities** (notebook cell `d43112f4` / `update_cities.py` STEP 2)

Look up latitude and longitude for each city via the Nominatim geocoder (OpenStreetMap).
The API requires a 1-second pause between requests. Results are written to
`data/processed/cities_master.csv`.

One city (Pristina, Kosovo) returned no result and is stored with null coordinates.

`update_cities.py` runs this incrementally: it diffs the current `cost-of-living.csv`
against the existing `cities_master.csv` and geocodes only cities not already present.

**Step 2 — Fetch climate projections** (notebook cell `536efda9` / `update_cities.py` STEP 3)

Call the Open-Meteo Climate API for all cities in one batch request. Four global climate
models (GCMs) are requested simultaneously:

- `CMCC_CM2_VHR4`
- `EC_Earth3P_HR`
- `MPI_ESM1_2_XR`
- `MRI_AGCM3_2_S`

Variables fetched: `temperature_2m_mean`, `temperature_2m_max`, `precipitation_sum`.
Date range: 1991-01-01 through 2050-12-31.

The API response is ordered as `[city_1_model_1, city_1_model_2, ..., city_1_model_4,
city_2_model_1, ...]`. For each city, the four model time series are concatenated and
averaged by date to produce an **ensemble mean**.

**Step 3 — Compute deltas** (same cells, continued)

Two periods are compared:
- Baseline: 1991-2020
- Future: 2040-2050

Four deltas are computed per city:

| Field | Meaning |
|---|---|
| `delta_temp_c` | Future annual mean temperature minus baseline annual mean (degrees C) |
| `delta_summer_temp_c` | Same, restricted to June-July-August |
| `delta_precip_pct` | Percentage change in annual precipitation total |
| `delta_heat_days` | Change in mean days per year with daily max temperature above 35 C |

Results are written to `data/processed/climate_projections.csv`.

`update_cities.py` increments this step too: it fetches projections only for cities not
already in `climate_projections.csv`, then appends before recomputing scores for all cities.

**Step 4 — Resilience score** (notebook cell `32092064` / `update_cities.py` STEP 4)

See the subsection below.

**Step 5 — Merge and export** (notebook cell `32092064` / `update_cities.py` STEP 5)

Join `cities_master.csv` + `cost-of-living.csv` + `climate_projections.csv` on
(`city`, `country`). Round all numeric fields to 2 decimal places. Export as a compact
JSON array (no whitespace) to `data/processed/cities_all.json`.

`update_cities.py` automatically copies the result to `web/public/data/cities_all.json`.
The notebook version requires a manual copy.

### Outputs

```
data/processed/
    cities_master.csv         (~8 KB — city, country, lat, lon)
    climate_projections.csv   (~20 KB — deltas + resilience per city)
    cities_all.json           (~140 KB — merged, all fields)
```

---

## Resilience Score

Computed across all cities together (not per-city in isolation), so the scores are
relative — a city is "resilient" relative to the rest of the dataset.

**Step 1 — Normalize each delta to a 0-100 vulnerability sub-score**

Min-max normalization: `score = (value - min) / (max - min) * 100`

Applied to:
- `delta_temp_c` (higher warming = higher vulnerability)
- `delta_summer_temp_c` (higher summer warming = higher vulnerability)
- `|delta_precip_pct|` (both drying and flooding count equally as bad)
- `delta_heat_days` (more extreme heat days = higher vulnerability)

**Step 2 — Equal-weight average**

```
vulnerability = 0.25 * temp_score
              + 0.25 * summer_score
              + 0.25 * precip_score
              + 0.25 * heat_score
```

**Step 3 — Invert**

```
resilience_score = 100 - vulnerability
```

**Step 4 — Assign tier**

| Resilience score | Tier |
|---|---|
| >= 75 | Low Risk |
| >= 50 | Moderate Risk |
| >= 25 | High Risk |
| < 25 | Critical |

As of last run (230 cities with valid projections): Low Risk 59, Moderate Risk 146,
High Risk 23, Critical 2. Most resilient: Dublin (97.0). Most vulnerable: Cagliari and
Granada (both 24.7 — Critical).

---

## How to Regenerate

### Pipeline A — Climate Grid

Requires: Python `.venv` active, ERA5 `.nc` files in `data/raw/`.

1. Open `notebooks/01_explore_era5.ipynb` in Jupyter.
2. Run cell `e14e06f0` — loads, reprojects, converts, derives sunshine, computes normals.
   This loads ~8 GB of data into memory and takes several minutes.
3. Run cell `f4341475` — exports 12 monthly JSON files + metadata to
   `data/processed/climate_normals/`.
4. Manually copy the contents of `data/processed/climate_normals/` to
   `web/public/data/climate_normals/`. (See Gaps section below.)

### Pipeline B — City Data

Requires: Python `.venv` active, run from the `scripts/` directory.

```
cd scripts
python update_cities.py
```

This runs all 5 steps incrementally. On first run it geocodes all 231 cities and fetches
60 years of daily projections for 4 models — expect it to take 10-30 minutes depending on
API response time. On subsequent runs with no new cities it is near-instant.

The script writes `web/public/data/cities_all.json` automatically.

To re-run the one-shot notebook version (e.g., for debugging):
1. Open `notebooks/01_explore_era5.ipynb`.
2. Run cells `d43112f4` (geocode), `536efda9` (projections), `32092064` (resilience + merge).
3. Copy `data/processed/cities_all.json` to `web/public/data/cities_all.json` manually.

---

## File Map

| Raw input | Intermediate | Web output |
|---|---|---|
| `data/raw/data_stream-moda_stepType-avgua.nc` (1.3 GB) | `data/processed/climate_normals/climate_*.json` | `web/public/data/climate_normals/climate_*.json` |
| `data/raw/data_stream-moda_stepType-avgad.nc` (2.6 GB) | `data/processed/climate_normals/climate_*.json` | `web/public/data/climate_normals/climate_*.json` |
| `data/raw/cost-of-living.csv` (21 KB) | `data/processed/cities_master.csv` | — |
| `data/raw/cost-of-living.csv` | `data/processed/climate_projections.csv` | — |
| `data/raw/cost-of-living.csv` + both processed CSVs | `data/processed/cities_all.json` | `web/public/data/cities_all.json` |

---

## Gaps and Open Questions

**1. Empty stub scripts**

`scripts/01_download_era5.py` through `scripts/06_export_for_frontend.py` and
`scripts/utils.py` are all 0 bytes. `CLAUDE.md` treats them as the canonical pipeline
description, but they have no code. If you want a runnable numbered-script pipeline in the
future, the notebook cells and `update_cities.py` are the source to port from.

**2. No automated copy step for climate normals**

After running Pipeline A (notebook cells `e14e06f0` + `f4341475`), the 12 monthly JSON
files land in `data/processed/climate_normals/`. There is no script that copies them to
`web/public/data/climate_normals/`. That step is currently manual and undocumented in the
codebase. (The files currently present in both folders are identical — they were copied at
some point — but regenerating Pipeline A requires redoing this copy by hand.)

**3. `update_cities.py` uses relative paths**

The script uses `r'..\data\raw\...'` style paths. It must be run from inside the `scripts/`
directory, not from the repo root.

**4. Pristina missing coordinates**

Nominatim could not resolve `Pristina, Kosovo (Disputed Territory)`. That city has `null`
lat/lon in `cities_master.csv` and is excluded from projection fetching. It appears in
`cities_all.json` with cost-of-living data but no climate fields.

**5. ERA5 data not in source control**

The two `.nc` files in `data/raw/` are gitignored. If you clone the repo fresh, you must
re-download them from the Copernicus Climate Data Store (CDS) before running Pipeline A.
The download logic does not yet exist (it would live in the stub `01_download_era5.py`).
