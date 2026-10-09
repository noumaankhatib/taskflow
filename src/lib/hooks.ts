"use client";
import useSWR, { type SWRConfiguration, mutate as globalMutate } from "swr";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, type Envelope, type PageMeta } from "./api";

const fetcher = (url: string) => api.page<unknown>(url).then((r) => r as Envelope<unknown>);

/** GET `/api/...` with caching + revalidation. Pass null to skip. */
export function useApi<T>(url: string | null, config?: SWRConfiguration) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Envelope<T>, ApiError>(url, fetcher as never, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    ...config,
  });
  return {
    data: data?.data,
    meta: data?.meta as PageMeta | undefined,
    error,
    isLoading,
    isValidating,
    reload: () => mutate(),
    mutate,
  };
}

/** Revalidate every cached GET whose URL starts with one of the given prefixes. */
export function invalidate(...prefixes: string[]) {
  return globalMutate((key) => typeof key === "string" && prefixes.some((p) => key.startsWith(p)));
}

/** Run an async action with busy state; errors are surfaced through `onError` (usually a toast). */
export function useAsyncAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>, onError?: (e: unknown) => void) {
  const [busy, setBusy] = useState(false);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const run = useCallback(
    async (...a: A): Promise<R | undefined> => {
      setBusy(true);
      try {
        return await fnRef.current(...a);
      } catch (e) {
        onError?.(e);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [onError],
  );
  return [run, busy] as const;
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(query: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}
