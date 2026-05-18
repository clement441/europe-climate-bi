// Color scale utilities for the climate heatmap and city bubble layers.

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function multiStopColor(ratio, stops) {
  if (ratio <= stops[0].at) return stops[0].color;
  if (ratio >= stops[stops.length - 1].at) return stops[stops.length - 1].color;
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio <= stops[i + 1].at) {
      const t = (ratio - stops[i].at) / (stops[i + 1].at - stops[i].at);
      return lerp(stops[i].color, stops[i + 1].color, t);
    }
  }
  return stops[stops.length - 1].color;
}

export const TEMP_STOPS = [
  { at: 0, color: [33, 102, 172] },
  { at: 0.5, color: [255, 255, 255] },
  { at: 1, color: [178, 24, 43] },
];
export const PRECIP_STOPS = [
  { at: 0, color: [255, 255, 204] },
  { at: 0.4, color: [65, 182, 196] },
  { at: 1, color: [12, 44, 132] },
];
export const SUN_STOPS = [
  { at: 0, color: [74, 20, 134] },
  { at: 0.2, color: [43, 140, 190] },
  { at: 0.4, color: [166, 217, 237] },
  { at: 0.6, color: [254, 227, 145] },
  { at: 0.8, color: [244, 109, 67] },
  { at: 1, color: [165, 0, 38] },
];
export const STOP_MAP = {
  temperature: TEMP_STOPS,
  precipitation: PRECIP_STOPS,
  sunshine: SUN_STOPS,
};

export function getColor(variable, value, min, max) {
  const range = max - min;
  const ratio = range === 0 ? 0.5 : Math.max(0, Math.min(1, (value - min) / range));
  const [r, g, b] = multiStopColor(ratio, STOP_MAP[variable]);
  return [r, g, b, 179];
}

export const GREEN_RED_STOPS = [
  { at: 0, color: [34, 139, 34] },
  { at: 0.5, color: [255, 200, 0] },
  { at: 1, color: [200, 30, 30] },
];

export function bubbleColor(value, min, max, invert) {
  if (value == null) return [160, 160, 160, 220];
  const range = max - min;
  let ratio = range === 0 ? 0.5 : Math.max(0, Math.min(1, (value - min) / range));
  if (invert) ratio = 1 - ratio;
  const [r, g, b] = multiStopColor(ratio, GREEN_RED_STOPS);
  return [r, g, b, 220];
}

export function stopsToGradient(stops) {
  const parts = stops.map(
    (s) => `rgb(${s.color[0]},${s.color[1]},${s.color[2]}) ${s.at * 100}%`
  );
  return `linear-gradient(to right, ${parts.join(", ")})`;
}
