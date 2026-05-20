import Link from "next/link";

export const metadata = {
  title: "About — European Climate & Living Costs Dashboard",
  description: "What this dashboard is, how to use it, where the data comes from, and who built it.",
};

const steps = [
  {
    n: "01",
    title: "Explore the climate map",
    body: "Drag the month slider at the top of the control panel to travel through January to December. Switch between Temperature, Rainfall, and Sunshine using the segmented control below the slider. The colour scale stays fixed across all months so you can directly compare — January blues versus July reds.",
  },
  {
    n: "02",
    title: "Discover cities",
    body: "Every bubble on the map is a city. Bubble colour shows where each city ranks on the metric you've selected in the \"City Bubbles\" dropdown — green is favourable, red less so. Hover over any bubble for a quick summary, or click to open the full city panel.",
  },
  {
    n: "03",
    title: "Dive into a city",
    body: "The city panel has three tabs. Climate shows the current month's temperature, rainfall, and sunshine alongside a full 12-month temperature sparkline. Cost lists rent, groceries, utilities, and more. Resilience shows how the city scores against future climate risk.",
  },
  {
    n: "04",
    title: "Compare two cities",
    body: "In the city panel, press the Pin button to lock a city into the compare tray. Pin a second city and a side-by-side comparison of 7 metrics appears automatically — with a winner bar highlighting the better figure in each row.",
  },
  {
    n: "05",
    title: "Search for a city",
    body: "Type any city name in the search box at the top of the control panel. Fuzzy matching handles typos and partial names — \"Munick\" still finds Munich. Use arrow keys to navigate the results and Enter or click to fly the map there.",
  },
];

const sources = [
  {
    label: "Climate heatmap",
    name: "ERA5 / Copernicus",
    body: "The colour grid covering Europe comes from ERA5, the European Centre for Medium-Range Weather Forecasts (ECMWF) global reanalysis dataset. It covers 1991–2020 at a 0.25° grid (~28 km per cell), giving 30-year WMO climate normals for temperature, precipitation, and solar radiation.",
  },
  {
    label: "City projections",
    name: "Open-Meteo",
    body: "The temperature and precipitation change figures shown per city come from the Open-Meteo climate projection API, which aggregates four CMIP6 global climate models to produce an ensemble mean. Figures represent expected change by 2050 under a moderate emissions scenario (SSP2-4.5).",
  },
  {
    label: "Cost of living",
    name: "Numbeo",
    body: "All rent, grocery, utility, and transport costs come from Numbeo, a crowdsourced cost-of-living database. The dataset covers 231 European cities with ~13 cost metrics each. The resilience score is computed from the climate projections and is relative — it ranks cities against each other, not against an absolute standard.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/20 font-sans">
      {/* Amber hairline — same visual identity as the map panels */}
      <div className="h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />

      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* ── Back link ───────────────────────────────────────────── */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-slate-400 hover:text-amber-600 transition-colors mb-10"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to map
        </Link>

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="mb-12">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-slate-500 mb-2">
            Climate Observatory
          </p>
          <h1 className="font-serif italic text-[36px] sm:text-[44px] leading-[1.02] text-slate-900 mb-3">
            European Climate<br />
            <span className="text-slate-500">&amp; Living Costs</span>
          </h1>
          <div className="flex items-center gap-2 mb-5">
            <span className="h-px w-6 bg-slate-900/30" />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-slate-600">
              About This Dashboard
            </p>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600">
            An interactive map that puts 30 years of European climate science and cost-of-living data
            in one place — so you can explore, compare, and make sense of Europe across both dimensions.
          </p>
        </header>

        {/* ── Section 1: What is this? ─────────────────────────────── */}
        <section className="mb-12">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-slate-500 mb-3">
            What is this?
          </p>
          <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
            <p>
              This dashboard combines two datasets that are rarely shown together: historical climate
              data and cost of living. The coloured grid covering Europe shows the 1991–2020 average
              temperature, rainfall, or sunshine for whichever month you select. The circles are 231
              cities, each colour-coded by the metric you choose — resilience score, rent, cost of
              living index, or projected temperature change.
            </p>
            <p>
              Click any city to see its full climate profile, cost breakdown, and an estimate of how
              much warmer (or drier) it is expected to become by 2050. Pin two cities to compare them
              side by side across seven metrics.
            </p>
            <p>
              The <span className="font-medium text-slate-900">resilience score</span> ranks each city
              by how well it is expected to weather future climate change — factoring in projected
              temperature rise, increase in extreme heat days, and precipitation shifts. A higher score
              means lower relative risk within this dataset of 231 cities.
            </p>
          </div>
        </section>

        {/* ── Section 2: How to use it ─────────────────────────────── */}
        <section className="mb-12">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-slate-500 mb-5">
            How to use it
          </p>
          <ol className="space-y-5">
            {steps.map(({ n, title, body }) => (
              <li key={n} className="flex gap-4">
                <span className="font-mono text-[11px] text-amber-600 tabular-nums pt-0.5 flex-shrink-0 w-5">
                  {n}
                </span>
                <div>
                  <p className="font-serif italic text-[17px] leading-snug text-slate-900 mb-1">
                    {title}
                  </p>
                  <p className="text-[14px] leading-relaxed text-slate-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Section 3: Data sources ──────────────────────────────── */}
        <section className="mb-12">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-slate-500 mb-5">
            Where does the data come from?
          </p>
          <div className="space-y-3">
            {sources.map(({ label, name, body }) => (
              <div
                key={name}
                className="bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-rose-50/40 rounded-xl p-4 ring-1 ring-amber-900/[0.06]"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-700 mb-1">
                  {label}
                </p>
                <p className="font-serif italic text-[16px] text-slate-900 mb-1.5">{name}</p>
                <p className="text-[13.5px] leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: About the author ──────────────────────────── */}
        <section className="mb-12 pt-8 border-t border-slate-900/10">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-slate-500 mb-4">
            About the author
          </p>
          <p className="text-[15px] leading-relaxed text-slate-700 mb-6">
            I&apos;m Clément, a data scientist and AI developer. Through{" "}
            <a
              href="https://www.datasaku.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-900 hover:text-amber-600 transition-colors underline underline-offset-2 decoration-slate-300 hover:decoration-amber-500"
            >
              Datasaku
            </a>
            , I help agrifood businesses build data pipelines and AI systems — and take on data
            science, analysis, and AI development projects more broadly. This dashboard is a
            portfolio piece demonstrating end-to-end data skills: raw satellite data acquisition,
            Python processing pipelines, and a polished interactive web application.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href="https://www.datasaku.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 ring-slate-900/15 bg-white/60 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600 hover:text-amber-600 hover:ring-amber-500/40 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6 1.5C6 1.5 4 4 4 6s2 4.5 2 4.5M6 1.5C6 1.5 8 4 8 6s-2 4.5-2 4.5M1.5 6h9" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              datasaku.com
            </a>
            <a
              href="https://github.com/clement441"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 ring-slate-900/15 bg-white/60 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600 hover:text-amber-600 hover:ring-amber-500/40 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M6 0C2.686 0 0 2.686 0 6c0 2.654 1.72 4.9 4.106 5.694.3.055.41-.13.41-.288 0-.143-.005-.52-.008-1.022-1.67.362-2.022-.805-2.022-.805-.273-.694-.667-0.879-.667-0.879-.545-.373.041-.365.041-.365.603.042.92.619.92.619.536.918 1.406.653 1.75.5.054-.388.21-.653.382-.803-1.334-.152-2.736-.667-2.736-2.97 0-.656.234-1.192.619-1.612-.062-.151-.268-.763.059-1.59 0 0 .504-.162 1.652.616A5.75 5.75 0 016 2.95a5.75 5.75 0 011.505.202c1.147-.778 1.65-.617 1.65-.617.328.828.122 1.44.06 1.59.386.42.618.956.618 1.612 0 2.31-1.404 2.816-2.742 2.964.216.186.408.553.408 1.114 0 .804-.007 1.453-.007 1.65 0 .16.108.347.413.288C10.282 10.898 12 8.653 12 6 12 2.686 9.314 0 6 0z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/clement-thony"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 ring-slate-900/15 bg-white/60 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-600 hover:text-amber-600 hover:ring-amber-500/40 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                <path d="M2.5 4H0v8h2.5V4zM1.25 2.9a1.45 1.45 0 110-2.9 1.45 1.45 0 010 2.9zM12 12H9.5V7.75c0-1-.02-2.3-1.4-2.3-1.4 0-1.6 1.1-1.6 2.2V12H4V4h2.4v1.1h.03c.33-.63 1.15-1.3 2.37-1.3C11.4 3.8 12 5.35 12 7.7V12z" />
              </svg>
              LinkedIn
            </a>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="pt-6 border-t border-slate-900/10 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-slate-400 hover:text-amber-600 transition-colors"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to map
          </Link>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-300">
            © {new Date().getFullYear()} Datasaku
          </span>
        </footer>

      </div>
    </div>
  );
}
