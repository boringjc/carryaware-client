import * as FileSystem from "expo-file-system/legacy";
import { ungzip } from "pako";
import { CDN_BASE } from "./config";

const cacheDir = FileSystem.cacheDirectory + "ccw_tiles/";
const manifestCachePath = cacheDir + "manifest.json";

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(cacheDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  }
}

export type ManifestTileEntry = {
  sha256: string;
  bytes: number;
  path: string;
};

export type Manifest = {
  schema_version: number;
  generated_at: string;
  dataset_version: string;
  tile_precision: number;
  tile_count: number;
  tiles: Record<string, ManifestTileEntry>;
};

export type Feature = {
  feature_id: string;
  category: string;
  name: string;
  address?: string | null;
  geom_type: "point";
  lat: number;
  lon: number;
  buffer_m: number;
  status?: string;
};

export type Tile = {
  tile_id: string;
  dataset_version: string;
  built_at: string;
  points: Feature[];
  polygons: any[];
};

export async function fetchManifest(): Promise<Manifest> {
  await ensureCacheDir();

  const url = `${CDN_BASE}/manifest/manifest.json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`manifest http ${res.status}`);

    const text = await res.text();
    await FileSystem.writeAsStringAsync(manifestCachePath, text);

    return JSON.parse(text) as Manifest;
  } catch (err) {
    // fallback to cached manifest if offline
    const info = await FileSystem.getInfoAsync(manifestCachePath);
    if (!info.exists) throw err;

    const cached = await FileSystem.readAsStringAsync(manifestCachePath);
    return JSON.parse(cached) as Manifest;
  }
}

function tileCachePath(datasetVersion: string, tileId: string) {
  return `${cacheDir}${datasetVersion}__${tileId}.json`;
}

/*
GZIP DETECTION HELPERS
Fixes: "incorrect header check"
CloudFront sends Content-Encoding:gzip which means
sometimes fetch auto-decompresses already.
We only ungzip if bytes truly gzip.
*/
function bytesLookGzipped(bytes: Uint8Array): boolean {
  // gzip magic header = 1F 8B
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

export async function fetchTile(
  manifest: Manifest,
  tileId: string
): Promise<Tile | null> {
  const entry = manifest.tiles?.[tileId];
  if (!entry) return null;

  await ensureCacheDir();

  const localPath = tileCachePath(manifest.dataset_version, tileId);
  const localInfo = await FileSystem.getInfoAsync(localPath);

  // Serve cached tile if present
  if (localInfo.exists) {
    const txt = await FileSystem.readAsStringAsync(localPath);
    return JSON.parse(txt) as Tile;
  }

  // Fetch from CDN
  const url = `${CDN_BASE}${entry.path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tile ${tileId} http ${res.status}`);

  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // Detect gzip vs already-decoded JSON
  let jsonText: string;

  if (bytesLookGzipped(bytes)) {
    // Still gzipped → decompress
    const decompressed = ungzip(bytes);
    jsonText = decodeUtf8(decompressed);
  } else {
    // Already plain JSON
    jsonText = decodeUtf8(bytes);
  }

  // Cache locally for performance
  await FileSystem.writeAsStringAsync(localPath, jsonText);

  return JSON.parse(jsonText) as Tile;
}
