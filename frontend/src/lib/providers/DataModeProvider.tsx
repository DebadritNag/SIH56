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
  isSwitching: boolean;
  switchingTo: DataMode | null;
}

const DataModeContext = createContext<DataModeContextValue | undefined>(undefined);
const STORAGE_KEY = "airpulse.data_mode";

import { CircleReloadingAnimation } from "@/components/ui/CircleReloadingAnimation";

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>("real");
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<DataMode | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "mock" || saved === "real") {
      const t = setTimeout(() => setModeState(saved), 0);
      return () => clearTimeout(t);
    }
  }, []);

  const setMode = (m: DataMode) => {
    if (m === mode) return;
    setIsSwitching(true);
    setSwitchingTo(m);
    setModeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, m);

    // Keep smooth circular reload animation active while queries re-fetch
    setTimeout(() => {
      setIsSwitching(false);
      setSwitchingTo(null);
    }, 850);
  };

  const toggle = () => setMode(mode === "real" ? "mock" : "real");

  const value = useMemo<DataModeContextValue>(
    () => ({
      mode,
      setMode,
      toggle,
      isSwitching,
      switchingTo,
    }),
    [mode, isSwitching, switchingTo],
  );

  return (
    <DataModeContext.Provider value={value}>
      {children}
      {isSwitching && (
        <CircleReloadingAnimation
          size="overlay"
          badge={switchingTo === "real" ? "SWITCHING TO LIVE DATA" : "SWITCHING TO DEMO DATA"}
          title={
            switchingTo === "real"
              ? "Connecting to Live Aviation Intelligence..."
              : "Activating Demo (Mock) Mode..."
          }
          subtitle={
            switchingTo === "real"
              ? "Synchronizing real-time flight telemetry, corridor quotes, and cryptographic hashes."
              : "Restoring standardized SIH demo baseline dataset for offline demonstration."
          }
        />
      )}
    </DataModeContext.Provider>
  );
}

export function useDataMode(): DataModeContextValue {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error("useDataMode must be used within a DataModeProvider");
  return ctx;
}

