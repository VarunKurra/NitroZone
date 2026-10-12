"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { mapBridge } from "@/components/map/map-bridge";
import { cn } from "@/lib/utils";

interface GeoResult {
  label: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number];
  type: string;
}

/** Address / town / county search (OpenStreetMap Nominatim via our server route). Keyboard accessible combobox. */
export function AddressSearch() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 450);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["geocode", debounced],
    enabled: debounced.length >= 3,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(debounced)}`, { signal });
      const json = (await res.json()) as { results: GeoResult[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      return json.results;
    },
  });
  const results = data ?? [];

  const choose = (r: GeoResult) => {
    setOpen(false);
    setQ(r.label.split(",").slice(0, 2).join(","));
    const [w, s, e, n] = r.bbox;
    const span = Math.max(e - w, n - s);
    if (span > 0.05) mapBridge.fitBounds([[w, s], [e, n]], 40);
    else mapBridge.flyTo([r.lon, r.lat], 15.5);
  };

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search for an address, town or county
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        ref={inputRef}
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Search address, town or county"
        className="h-11 rounded-xl bg-white pl-9 pr-9 text-[0.95rem]"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {isFetching ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />
        ) : q ? (
          <button
            type="button"
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {open && debounced.length >= 3 && !isFetching && (results.length > 0 || isError) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-auto rounded-xl border bg-white p-1 shadow-[var(--shadow-float)]"
        >
          {isError && <li className="px-3 py-2 text-sm text-muted-foreground">Search is unavailable. Pan and zoom the map instead.</li>}
          {results.map((r, i) => (
            <li
              key={`${r.lat},${r.lon},${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm", i === active && "bg-muted")}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="line-clamp-2">{r.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
