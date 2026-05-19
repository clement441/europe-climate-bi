export function nearestIdx(arr, val) {
  return arr.reduce((best, v, i) => Math.abs(v - val) < Math.abs(arr[best] - val) ? i : best, 0);
}

export function nearestGridValue(climateData, lat, lon, variable) {
  if (!climateData || lat == null || lon == null) return null;
  const latIdx = nearestIdx(climateData.lats, lat);
  const lonIdx = nearestIdx(climateData.lons, lon);
  return climateData[variable]?.[latIdx]?.[lonIdx] ?? null;
}
