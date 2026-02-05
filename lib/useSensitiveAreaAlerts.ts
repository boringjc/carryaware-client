import * as Location from "expo-location";
import ngeohash from "ngeohash";
import { useEffect, useRef, useState } from "react";
import { fetchManifest, fetchTile, Feature, Manifest } from "./dataClient";
import { haversineMeters } from "./geo";
import { sendAlert } from "./notify";
import { GEOHASH_PRECISION, LOCATION_POLL_MS, ALERT_COOLDOWN_MS } from "./config";

type AlertState = {
  lastAlertAt: number;
  insideFeatureIds: Set<string>;
};

const SENSITIVITY_PRESETS = {
  tight: 0.7,
  normal: 1.0,
  wide: 1.3,
} as const;

export type SensitivityLevel = keyof typeof SENSITIVITY_PRESETS;

export type DebugState = {
  lat?: number;
  lon?: number;
  geohash7?: string;

  datasetVersion?: string;

  tilesRequested?: string[];
  tilesLoaded?: number;

  featuresEvaluated?: number;

  nearestName?: string;
  nearestCategory?: string;
  nearestMeters?: number;

  insideCount?: number;

  lastAlertAt?: number;
  lastAlertName?: string;
  lastAlertCategory?: string;

  // New: sensitivity visibility
  sensitivity?: SensitivityLevel;
  bufferMultiplier?: number;
  nearestBaseBufferM?: number;
  nearestEffectiveBufferM?: number;

  lastError?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function useSensitiveAreaAlerts() {
  const [status, setStatus] = useState("init");
  const [debug, setDebug] = useState<DebugState>({});

  // New: allow client to adjust sensitivity
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>("normal");

  const manifestRef = useRef<Manifest | null>(null);
  const alertState = useRef<AlertState>({
    lastAlertAt: 0,
    insideFeatureIds: new Set<string>(),
  });

  useEffect(() => {
    let timer: any;
    let cancelled = false;

    async function start() {
      try {
        setStatus("requesting-location");

        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          setStatus("location-denied");
          setDebug((d) => ({ ...d, lastError: "Location permission denied" }));
          return;
        }

        setStatus("loading-manifest");
        const m = await fetchManifest();
        if (cancelled) return;

        manifestRef.current = m;
        setDebug((d) => ({
          ...d,
          datasetVersion: m.dataset_version,
          lastError: undefined,
        }));

        setStatus("running");

        timer = setInterval(async () => {
          const manifest = manifestRef.current;
          if (!manifest) return;

          try {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });

            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            const center = ngeohash.encode(lat, lon, GEOHASH_PRECISION);
            const neighbors = ngeohash.neighbors(center);
            const tilesToLoad = [center, ...neighbors];

            setDebug((d) => ({
              ...d,
              lat,
              lon,
              geohash7: center,
              tilesRequested: tilesToLoad,
              tilesLoaded: tilesToLoad.length,
              datasetVersion: manifest.dataset_version,
              lastError: undefined,
              sensitivity,
              bufferMultiplier: SENSITIVITY_PRESETS[sensitivity],
            }));

            const features: Feature[] = [];
            for (const tid of tilesToLoad) {
              const tile = await fetchTile(manifest, tid);
              if (tile?.points?.length) {
                features.push(...tile.points);
              }
            }

            setDebug((d) => ({
              ...d,
              featuresEvaluated: features.length,
            }));

            const multiplier = SENSITIVITY_PRESETS[sensitivity];

            let nearestMeters = Number.POSITIVE_INFINITY;
            let nearestName = "";
            let nearestCategory = "";
            let nearestBaseBufferM = 0;
            let nearestEffectiveBufferM = 0;

            const newlyInside: Feature[] = [];
            const stillInside = new Set<string>();

            for (const f of features) {
              const dist = haversineMeters(lat, lon, f.lat, f.lon);

              // Nearest tracking
              if (dist < nearestMeters) {
                nearestMeters = dist;
                nearestName = f.name;
                nearestCategory = f.category;

                const baseBuffer = typeof f.buffer_m === "number" ? f.buffer_m : 0;
                const effective = clamp(baseBuffer * multiplier, 50, 500);

                nearestBaseBufferM = baseBuffer;
                nearestEffectiveBufferM = effective;
              }

              // Inside detection with sensitivity multiplier
              const baseBuffer = typeof f.buffer_m === "number" ? f.buffer_m : 0;
              const effectiveBuffer = clamp(baseBuffer * multiplier, 50, 500);

              if (baseBuffer > 0 && dist <= effectiveBuffer) {
                stillInside.add(f.feature_id);
                if (!alertState.current.insideFeatureIds.has(f.feature_id)) {
                  newlyInside.push(f);
                }
              }
            }

            // Update inside state
            alertState.current.insideFeatureIds = stillInside;

            setDebug((d) => ({
              ...d,
              nearestMeters: Number.isFinite(nearestMeters) ? nearestMeters : undefined,
              nearestName: nearestName || undefined,
              nearestCategory: nearestCategory || undefined,
              nearestBaseBufferM: nearestBaseBufferM || undefined,
              nearestEffectiveBufferM: nearestEffectiveBufferM || undefined,
              insideCount: stillInside.size,
              lastAlertAt: alertState.current.lastAlertAt || undefined,
              sensitivity,
              bufferMultiplier: multiplier,
            }));

            const now = Date.now();
            const cooledDown = now - alertState.current.lastAlertAt > ALERT_COOLDOWN_MS;

            if (newlyInside.length > 0 && cooledDown) {
              const top = newlyInside[0];

              // Send iOS local notification (guarded in notify.ts)
              await sendAlert("Sensitive area nearby", `${top.name} (${top.category})`);

              alertState.current.lastAlertAt = now;

              setDebug((d) => ({
                ...d,
                lastAlertAt: now,
                lastAlertName: top.name,
                lastAlertCategory: top.category,
              }));
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setDebug((d) => ({ ...d, lastError: msg }));
          }
        }, LOCATION_POLL_MS);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus("error");
        setDebug((d) => ({ ...d, lastError: msg }));
      }
    }

    start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [sensitivity]);

  // Return setter so UI can change sensitivity at runtime
  return { status, debug, sensitivity, setSensitivity };
}
