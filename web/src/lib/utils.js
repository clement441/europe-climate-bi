export function formatMetric(value, metric, decimals = 1) {
  if (value == null) return "N/A";
  const v = value.toFixed(decimals);
  return metric.unitPrefix ? `${metric.unit}${v}` : `${v}${metric.unit}`;
}
