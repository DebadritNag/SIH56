"use client";

/**
 * Global data mode: REAL (default) vs MOCK (demo fallback).
 *
 * - REAL: hooks fetch from FastAPI; if a request fails they surface the error/empty state
 *   OR (per hook) fall back to mock explicitly flagged as mock.
 * - MOCK: hooks return the built-in demo dataset, always flagged with a MOCK badge.
 *
 * Persisted in localStorage. Never silently disguises mock as real.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DataMode = "real" | "mock";

interface DataModeContextValue {
  mode: DataMode;
  setMode: (m: DataMode) => void;
  toggle: () => void;
}

const DataModeContext = createContext<DataModeContextValue | undefined>(undefined);
const STORAGE_KEY = "airpulse.data_mode";

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>("real");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "mock" || saved === "real") setModeState(saved);
  }, []);

  const setMode = (m: DataMode) => {
    setModeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, m);
  };

  const value = useMemo<DataModeContextValue>(
    () => ({ mode, setMode, toggle: () => setMode(mode === "real" ? "mock" : "real") }),
    [mode],
  );

  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

export function useDataMode(): DataModeContextValue {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error("useDataMode must be used within a DataModeProvider");
  return ctx;
}
