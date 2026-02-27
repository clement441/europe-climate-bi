# European Climate & Living Costs Dashboard

An interactive BI tool mapping European climate data (ERA5), cost-of-living metrics (Numbeo), and climate change resilience projections (CMIP6) for 230+ cities across Europe.

## Live Demo

> **[https://your-app.vercel.app](https://your-app.vercel.app)** — *update after deployment*

## Features

- Interactive map with city-level climate normals (temperature, precipitation, sunshine hours)
- Cost-of-living comparisons across European cities
- Climate change resilience projections using CMIP6 scenarios
- Monthly and seasonal data exploration

## Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS
- **Mapping:** MapLibre GL, Deck.gl
- **Data Processing:** Python, xarray, pandas
- **Deployment:** Vercel

## Data Sources

- [Copernicus ERA5](https://cds.climate.copernicus.eu/) — historical climate reanalysis
- [Open-Meteo Climate API](https://open-meteo.com/) — climate normals and projections
- [Numbeo](https://www.numbeo.com/) — cost-of-living indices

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
web/
├── public/data/          # Pre-processed JSON data for the frontend
│   ├── cities_all.json
│   └── climate_normals/  # Monthly climate data (Jan–Dec)
├── src/app/
│   ├── page.js           # Main dashboard page
│   ├── layout.js         # Root layout
│   └── globals.css       # Global styles
├── next.config.mjs
└── package.json
```

## License

MIT
