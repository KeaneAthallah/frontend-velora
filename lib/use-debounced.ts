"use client";

import * as React from "react";

/** Debounce a value so search fields do not fire a request per keystroke. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Read a query-string value on mount and expose a ready flag. Pages are
 * client-rendered; writing the value back before this resolves would erase
 * deep links such as /products?q=coffee.
 */
export function useSearchParamState(
  key: string
): [string, React.Dispatch<React.SetStateAction<string>>, boolean] {
  const [value, setValue] = React.useState("");
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setValue(new URLSearchParams(window.location.search).get(key) ?? "");
    setReady(true);
  }, [key]);

  return [value, setValue, ready];
}

/** Set or delete a query-string value without adding a history entry. */
export function replaceSearchParam(key: string, value: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(null, "", url.toString());
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}
