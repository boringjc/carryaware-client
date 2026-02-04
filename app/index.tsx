import { Text, View, Button } from "react-native";
import { useEffect, useState } from "react";
import DebugOverlay from "../components/DebugOverlay";
import { useSensitiveAreaAlerts } from "../lib/useSensitiveAreaAlerts";
import { initNotifications } from "../lib/notify";
import { fetchManifest, fetchTile } from "../lib/dataClient";

export default function HomeScreen() {
  const { status, debug } = useSensitiveAreaAlerts();

  const [manifestInfo, setManifestInfo] = useState<any>(null);
  const [tileInfo, setTileInfo] = useState<any>(null);
  const [manifestObj, setManifestObj] = useState<any>(null);

  useEffect(() => {
    initNotifications();
  }, []);

  async function testManifest() {
    const m = await fetchManifest();
    setManifestObj(m);
    setManifestInfo({
      dataset_version: m.dataset_version,
      tile_count: m.tile_count,
    });
    setTileInfo(null);
  }

  async function testOneTile() {
    if (!manifestObj) {
      setTileInfo({ error: "Run Test: Fetch Manifest first" });
      return;
    }

    const tileIds = Object.keys(manifestObj.tiles || {});
    if (tileIds.length === 0) {
      setTileInfo({ error: "Manifest has no tiles" });
      return;
    }

    const firstTileId = tileIds[0];
    const tile = await fetchTile(manifestObj, firstTileId);

    setTileInfo({
      tile_id: firstTileId,
      points: tile?.points?.length ?? 0,
      dataset_version: tile?.dataset_version ?? manifestObj.dataset_version,
    });
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: 12 }}>
        CCW Alert MVP
      </Text>

      <Text style={{ marginBottom: 16 }}>Status: {status}</Text>

      <Button title="Test: Fetch Manifest" onPress={testManifest} />
      <View style={{ height: 12 }} />
      <Button title="Test: Fetch One Tile" onPress={testOneTile} />

      {manifestInfo && (
        <View style={{ marginTop: 20 }}>
          <Text>Dataset: {manifestInfo.dataset_version}</Text>
          <Text>Tiles: {manifestInfo.tile_count}</Text>
        </View>
      )}

      {tileInfo && (
        <View style={{ marginTop: 16 }}>
          {tileInfo.error ? (
            <Text>Tile test error: {tileInfo.error}</Text>
          ) : (
            <>
              <Text>Tile: {tileInfo.tile_id}</Text>
              <Text>Points in tile: {tileInfo.points}</Text>
              <Text>Tile dataset: {tileInfo.dataset_version}</Text>
            </>
          )}
        </View>
      )}

      <DebugOverlay status={status} debug={debug} />
    </View>
  );
}
