function fmtPrice(v) {
  return v != null ? `€${Math.round(v)}` : "N/A";
}
function fmtTemp(v) {
  return v != null ? `${v.toFixed(1)}°C` : "N/A";
}
function fmtPct(v) {
  return v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "N/A";
}
function fmtNum(v, dec = 1) {
  return v != null ? v.toFixed(dec) : "N/A";
}
function fmtSigned(v, dec, unit) {
  if (v == null) return "N/A";
  return `${v > 0 ? "+" : ""}${v.toFixed(dec)}${unit}`;
}

function riskBadge(tier) {
  switch (tier) {
    case "Low Risk": return "bg-green-100 text-green-800";
    case "Moderate Risk": return "bg-yellow-100 text-yellow-800";
    case "High Risk": return "bg-orange-100 text-orange-800";
    case "Critical": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-600";
  }
}

function riskBarColor(tier) {
  switch (tier) {
    case "Low Risk": return "bg-green-500";
    case "Moderate Risk": return "bg-yellow-500";
    case "High Risk": return "bg-orange-500";
    case "Critical": return "bg-red-500";
    default: return "bg-gray-400";
  }
}

function DetailRow({ label, value, className = "" }) {
  const isNA = value === "N/A";
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-500">{label}</span>
      <span className={isNA ? "text-gray-300" : `font-medium text-gray-900 ${className}`}>{value}</span>
    </div>
  );
}

export default function CityDetailPanel({ city, onClose }) {
  if (!city) return null;
  return (
    <div className="absolute top-0 right-0 z-50 w-full sm:w-[350px] h-full bg-white shadow-2xl overflow-y-auto border-l border-gray-200">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-lg"
      >
        ✕
      </button>

      <div className="p-5 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 pr-8">{city.city}</h2>
          <p className="text-sm text-gray-500">{city.country?.trim()}</p>
          {city.risk_tier && (
            <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${riskBadge(city.risk_tier)}`}>
              {city.risk_tier}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Cost of Living</h3>
          <div className="text-xs divide-y divide-gray-50">
            <DetailRow label="Cost of Living Index" value={fmtNum(city["cost-of-living-index"])} />
            <DetailRow label="1-Bed Rent (city)" value={fmtPrice(city["one-bedroom-city-rent"])} />
            <DetailRow label="3-Bed Rent (city)" value={fmtPrice(city["three-bedroom-city-rent"])} />
            <DetailRow label="Restaurant Meal" value={fmtPrice(city["meal-restaurant"])} />
            <DetailRow label="Public Transport (monthly)" value={fmtPrice(city["monthly-public-transport-pass"])} />
            <DetailRow label="Basic Utilities (85m²)" value={fmtPrice(city["basic-utilities-85m2-apartment"])} />
            <DetailRow label="Cinema Ticket" value={fmtPrice(city["cinema-ticket"])} />
            <DetailRow label="Price/m² (buy)" value={fmtPrice(city["price-square-meter-buy"])} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Groceries</h3>
          <div className="text-xs divide-y divide-gray-50">
            <DetailRow label="Milk (1L)" value={fmtPrice(city["1l-milk"])} />
            <DetailRow label="Chicken (1kg)" value={fmtPrice(city["chicken"])} />
            <DetailRow label="Bread (500g)" value={fmtPrice(city["bread"])} />
            <DetailRow label="Rice (1kg)" value={fmtPrice(city["rice"])} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Climate Projections</h3>
          <div className="text-xs divide-y divide-gray-50">
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Temperature</span>
              <span className="font-medium text-gray-900">
                {fmtTemp(city.baseline_temp_c)} → {fmtTemp(city.future_temp_c)}
                {city.delta_temp_c != null && (
                  <span className={`ml-1 ${city.delta_temp_c >= 0 ? "text-red-600" : "text-blue-600"}`}>
                    ({fmtSigned(city.delta_temp_c, 1, "°C")})
                  </span>
                )}
              </span>
            </div>
            <DetailRow
              label="Summer Temp Change"
              value={fmtSigned(city.delta_summer_temp_c, 1, "°C")}
              className={city.delta_summer_temp_c != null && city.delta_summer_temp_c < 0 ? "text-blue-600" : "text-red-600"}
            />
            <DetailRow
              label="Precipitation Change"
              value={fmtPct(city.delta_precip_pct)}
              className={city.delta_precip_pct != null ? (city.delta_precip_pct >= 0 ? "text-green-600" : "text-red-600") : ""}
            />
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Extreme Heat Days</span>
              <span className="font-medium text-gray-900">
                {fmtNum(city.baseline_heat_days, 0)} → {fmtNum(city.future_heat_days, 0)}
                {city.delta_heat_days != null && (
                  <span className={`ml-1 ${city.delta_heat_days >= 0 ? "text-red-600" : "text-blue-600"}`}>
                    ({fmtSigned(city.delta_heat_days, 0, "")})
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {city.resilience_score != null && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Resilience</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${riskBarColor(city.risk_tier)}`}
                  style={{ width: `${city.resilience_score}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-800 w-10 text-right">
                {city.resilience_score.toFixed(0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
