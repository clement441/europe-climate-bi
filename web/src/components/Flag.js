"use client";

import { countryToISO } from "../lib/countryFlags";

export default function Flag({
  country,
  size = "w20",
  className = "h-3 w-auto rounded-[1px] flex-shrink-0 ring-1 ring-slate-900/[0.04]",
  alt = "",
}) {
  const iso = countryToISO(country?.trim());
  if (!iso) return null;
  return (
    <img
      src={`https://flagcdn.com/${size}/${iso}.webp`}
      alt={alt}
      className={className}
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}
