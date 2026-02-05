import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SENSITIVITY_PRESETS = {
  tight: 0.7,
  normal: 1.0,
  wide: 1.3,
} as const;

export type SensitivityLevel = keyof typeof SENSITIVITY_PRESETS;

type SettingsState = {
  sensitivity: SensitivityLevel;
  setSensitivity: (v: SensitivityLevel) => void;
};

const STORAGE_KEY = "carryaware:sensitivity:v1";

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [sensitivity, setSensitivityState] = useState<SensitivityLevel>("normal");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === "tight" || raw === "normal" || raw === "wide") {
          setSensitivityState(raw);
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setSensitivity = async (v: SensitivityLevel) => {
    setSensitivityState(v);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore persistence errors, keep in-memory value
    }
  };

  const value = useMemo<SettingsState>(() => ({ sensitivity, setSensitivity }), [sensitivity]);

  // Avoid flashing default value before storage loads
  if (!loaded) return null;

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export function sensitivityToSliderValue(s: SensitivityLevel): number {
  if (s === "tight") return 0;
  if (s === "normal") return 1;
  return 2;
}

export function sliderValueToSensitivity(v: number): SensitivityLevel {
  if (v <= 0.5) return "tight";
  if (v <= 1.5) return "normal";
  return "wide";
}
