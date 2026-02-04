import { View, Text, Pressable, ScrollView } from "react-native";
import { useMemo, useState } from "react";

type Props = {
  status: string;
  debug: any;
};

function fmt(n?: number, digits = 6) {
  if (n === undefined || n === null) return "-";
  return Number(n).toFixed(digits);
}

function fmtMeters(n?: number) {
  if (n === undefined || n === null) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(2)} km`;
  return `${Math.round(n)} m`;
}

export default function DebugOverlay({ status, debug }: Props) {
  const [open, setOpen] = useState(true);

  const tiles = useMemo(() => {
    const t: string[] = debug?.tilesRequested || [];
    if (!Array.isArray(t)) return [];
    return t.slice(0, 9);
  }, [debug]);

  const alertTime = debug?.lastAlertAt ? new Date(debug.lastAlertAt).toLocaleTimeString() : "-";

  return (
    <View
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        top: 44,
        borderRadius: 12,
        padding: 10,
        backgroundColor: "rgba(0,0,0,0.75)",
      }}
      pointerEvents="box-none"
    >
      <Pressable onPress={() => setOpen((v) => !v)} style={{ paddingVertical: 6 }}>
        <Text style={{ color: "white", fontWeight: "700" }}>
          Debug Overlay {open ? "(tap to collapse)" : "(tap to expand)"}
        </Text>
      </Pressable>

      {open && (
        <ScrollView style={{ maxHeight: 220 }}>
          <Text style={{ color: "white" }}>Status: {status}</Text>

          <Text style={{ color: "white" }}>
            Lat/Lon: {fmt(debug?.lat)} , {fmt(debug?.lon)}
          </Text>

          <Text style={{ color: "white" }}>Geohash7: {debug?.geohash7 || "-"}</Text>

          <Text style={{ color: "white" }}>Dataset: {debug?.datasetVersion || "-"}</Text>

          <Text style={{ color: "white" }}>
            Tiles requested: {tiles.length ? tiles.join(", ") : "-"}
          </Text>

          <Text style={{ color: "white" }}>
            Features evaluated: {debug?.featuresEvaluated ?? "-"}
          </Text>

          <Text style={{ color: "white" }}>
            Nearest: {debug?.nearestName || "-"}
            {debug?.nearestCategory ? ` (${debug.nearestCategory})` : ""}
          </Text>

          <Text style={{ color: "white" }}>
            Nearest distance: {fmtMeters(debug?.nearestMeters)}
          </Text>

          <Text style={{ color: "white" }}>
            Inside count: {debug?.insideCount ?? "-"}
          </Text>

          <Text style={{ color: "white" }}>
            Last alert: {alertTime}
            {debug?.lastAlertName
              ? ` | ${debug.lastAlertName} (${debug?.lastAlertCategory || ""})`
              : ""}
          </Text>

          {debug?.lastError && (
            <Text style={{ color: "salmon", marginTop: 6 }}>
              Error: {String(debug.lastError)}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
