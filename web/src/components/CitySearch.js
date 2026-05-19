"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import Flag from "./Flag";

const FUSE_OPTIONS = {
  keys: [
    { name: "city", weight: 0.7 },
    { name: "country", weight: 0.3 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 1,
};

const MAX_RESULTS = 8;

export default function CitySearch({
  cities,
  onSelect,
  hideLabel = false,
  placeholder = "Search city…",
  excludeCities = [],
  autoFocus = false,
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const fuse = useMemo(
    () => (cities && cities.length ? new Fuse(cities, FUSE_OPTIONS) : null),
    [cities],
  );

  const excludeKeys = useMemo(
    () => new Set(excludeCities.map((c) => `${c.city}|${c.country}`)),
    [excludeCities],
  );

  const results = useMemo(() => {
    if (!fuse || !query.trim()) return [];
    const raw = fuse.search(query.trim(), { limit: MAX_RESULTS + excludeKeys.size });
    const filtered = excludeKeys.size
      ? raw.filter((r) => !excludeKeys.has(`${r.item.city}|${r.item.country}`))
      : raw;
    return filtered.slice(0, MAX_RESULTS);
  }, [fuse, query, excludeKeys]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(results.length ? 0 : -1);
  }, [results]);

  const commit = (city) => {
    if (!city) return;
    onSelect?.(city);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const handleKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!results.length) return;
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!results.length) return;
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[activeIndex >= 0 ? activeIndex : 0];
      if (pick) commit(pick.item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      {!hideLabel && (
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-400 mb-2">
          Locate
        </p>
      )}

      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.3" />
          <path d="M9.3 9.3 L12.4 12.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          aria-label="Search city"
          disabled={!cities}
          className="w-full pl-9 pr-8 py-2 rounded-lg text-[12px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 placeholder:font-normal placeholder:text-slate-400 border-0 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setQuery(""); setActiveIndex(-1); inputRef.current?.focus(); }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-300 transition-colors text-[10px] leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-30 bg-white/95 backdrop-blur-xl rounded-xl ring-1 ring-slate-900/10 shadow-[0_8px_28px_rgba(15,23,42,0.10)] overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />

          {results.length > 0 ? (
            <ul className="py-1 max-h-[280px] overflow-y-auto">
              {results.map((r, i) => (
                <ResultRow
                  key={`${r.item.city}-${r.item.country}-${i}`}
                  city={r.item}
                  active={i === activeIndex}
                  onHover={() => setActiveIndex(i)}
                  onSelect={() => commit(r.item)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState />
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ city, active, onHover, onSelect }) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={active}
        onMouseEnter={onHover}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSelect}
        className={`relative w-full text-left flex items-center gap-2.5 pl-3 pr-3 py-2 transition-colors ${
          active ? "bg-slate-50" : "hover:bg-slate-50/60"
        }`}
      >
        <span
          className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-amber-500 rounded-r-sm transition-opacity duration-150 ${
            active ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        />

        <Flag country={city.country} className="h-3 w-auto rounded-[1px] flex-shrink-0 mt-px ring-1 ring-slate-900/[0.04]" />

        <span className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
          <span className="font-serif italic text-[14px] leading-tight text-slate-900 truncate">
            {city.city}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 leading-tight truncate flex-shrink-0 max-w-[40%]">
            {city.country?.trim()}
          </span>
        </span>

        <svg
          className={`w-2.5 h-2.5 text-amber-600 flex-shrink-0 transition-opacity duration-150 ${
            active ? "opacity-100" : "opacity-0"
          }`}
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
        >
          <path d="M3 1.5 L7 5 L3 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="px-4 py-5 flex flex-col items-center gap-1.5">
      <span className="h-px w-6 bg-slate-300" />
      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-slate-400">
        No matches
      </p>
      <p className="font-serif italic text-[11px] text-slate-400">
        Try a different spelling
      </p>
    </div>
  );
}
