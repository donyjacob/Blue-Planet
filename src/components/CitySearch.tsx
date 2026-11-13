"use client";

import { useMemo, useState } from "react";
import { GLOBAL_CITIES, type City } from "@/lib/cities";
import { formatTimeInZone } from "@/lib/time";

type Props = {
  placeholder: string;
  onSelect: (city: City) => void;
};

export function CitySearch({ placeholder, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOBAL_CITIES.slice(0, 10);
    return GLOBAL_CITIES.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.tz.toLowerCase().includes(q),
    ).slice(0, 12);
  }, [query]);

  return (
    <div className="relative">
      <input
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        autoComplete="off"
      />
      {open && (
        <div className="city-results">
          {matches.length === 0 ? (
            <div className="muted" style={{ padding: "0.8rem" }}>
              No matching city. Try a major nearby city.
            </div>
          ) : (
            matches.map((item) => (
              <button
                key={`${item.city}-${item.tz}`}
                type="button"
                className="city-option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(item);
                  setQuery(`${item.city}, ${item.country}`);
                  setOpen(false);
                }}
              >
                <span>
                  {item.flag} {item.city}, {item.country}
                  <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
                    {item.tz}
                  </div>
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--sea)" }}>
                  {formatTimeInZone(new Date(), item.tz)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
