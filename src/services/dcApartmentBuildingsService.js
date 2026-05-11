/**
 * DC Apartment Buildings Service
 *
 * Pulls multi-unit residential building data from DC public APIs, normalises
 * it to a common internal shape, deduplicates by SSL (parcel ID), and enriches
 * with official building names from three sources in priority order:
 *   1. MAR Aliases   — official DC "place names" registered in the city's
 *                      Master Address Repository
 *   2. Affordable Housing project names — DMPED/DHCD programme names
 *   3. OpenStreetMap proximity match   — branded/marketing names from OSM
 *
 * Data-quality caveats (surfaced to users via `source` field):
 *   - MAR RESIDENTIAL_UNIT_COUNT is the city's best building-level unit count
 *     but can lag new construction or conversions by months.
 *   - MAR place names exist for ~81 % of 20+ unit buildings; smaller stock
 *     has sparse coverage.
 *   - Year-built (ayb) comes from the DC OTR Commercial CAMA table, which
 *     covers buildings DC classifies commercially (typically 20+ units).
 *     Smaller apartment buildings will have ayb = null.
 *   - Affordable Housing data covers DMPED/DHCD projects tracked since 2015;
 *     it is not a complete apartment registry.
 *   - OSM coverage is community-maintained and incomplete.
 */

// ─── API endpoint registry ────────────────────────────────────────────────────
// All URLs and query parameters live here so they are easy to update.

const ARCGIS = 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA';

export const ENDPOINTS = {
  /** MAR Address Points — primary source; building-level lat/lng, unit count, SSL */
  MAR_ADDRESS_POINTS: `${ARCGIS}/Location_WebMercator/MapServer/0`,
  /** MAR Aliases — official DC "place names" keyed by MAR_ID */
  MAR_ALIASES:        `${ARCGIS}/Location_WebMercator/MapServer/3`,
  /** OTR Commercial CAMA — year-built (AYB) keyed by SSL */
  CAMA_COMMERCIAL:    `${ARCGIS}/Property_and_Land_WebMercator/MapServer/23`,
  /** DMPED/DHCD Affordable Housing — project names (supplemental enrichment only) */
  AFFORDABLE_HOUSING: `${ARCGIS}/Property_and_Land_WebMercator/MapServer/62`,
  /** Overpass API — OSM named buildings for final-pass name enrichment */
  OVERPASS:           'https://overpass-api.de/api/interpreter',
};

/** Minimum residential unit count for a building to be included */
export const MIN_UNITS = 10;

/** DC bounding box [south,west,north,east] for the OSM Overpass query */
const DC_BBOX = '38.80,-77.12,38.99,-76.91';

// ─── String helpers ───────────────────────────────────────────────────────────

/**
 * Convert an ALL-CAPS DC address to Title Case.
 * Quadrant abbreviations (NW, NE, SW, SE) are kept fully upper-case.
 */
export function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Nw|Ne|Sw|Se)\b/g, (m) => m.toUpperCase());
}

/** Normalise an SSL string (trim whitespace) */
export function normaliseSSL(ssl) {
  return ssl ? ssl.trim() : null;
}

/** Normalise an address for fuzzy-match deduplication (upper-case, collapsed spaces) */
export function normaliseAddress(addr) {
  return addr ? addr.toUpperCase().replace(/\s+/g, ' ').trim() : '';
}

// ─── ArcGIS REST fetch utilities ─────────────────────────────────────────────

/**
 * Paginated ArcGIS REST query.
 * Follows `exceededTransferLimit` pages until all features are collected.
 *
 * @param {string} url      — MapServer layer URL (without /query)
 * @param {object} [params] — extra URLSearchParams (merged over defaults)
 * @returns {Promise<Array>} array of raw ArcGIS feature objects
 */
export async function fetchAllArcGisFeatures(url, params = {}) {
  const PAGE = 1000;
  const features = [];
  let offset = 0;

  for (;;) {
    const qs = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      outSR: '4326',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: 'json',
      ...params,
    });
    const res = await fetch(`${url}/query?${qs}`);
    if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}: ${url}`);
    const json = await res.json();
    if (json.error) throw new Error(`ArcGIS error ${json.error.code}: ${json.error.message}`);
    const page = json.features ?? [];
    features.push(...page);
    if (!json.exceededTransferLimit || page.length < PAGE) break;
    offset += PAGE;
  }

  return features;
}

/**
 * Batch POST query to an ArcGIS layer using an SSL IN (...) clause.
 * Splits the list into chunks to stay within server limits.
 * Individual batch failures are tolerated (logged, skipped).
 *
 * @param {string}   url       — MapServer layer URL (without /query)
 * @param {string[]} sslList   — list of SSL strings to query
 * @param {string}   outFields — comma-separated field names
 * @param {number}   [batchSize=500]
 * @returns {Promise<Array>} flat array of feature attribute objects
 */
async function batchQueryBySSL(url, sslList, outFields, batchSize = 500) {
  const results = [];
  for (let i = 0; i < sslList.length; i += batchSize) {
    const chunk = sslList.slice(i, i + batchSize);
    const sqlIn = chunk.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
    try {
      const res = await fetch(`${url}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ where: `SSL IN (${sqlIn})`, outFields, f: 'json' }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      results.push(...(json.features ?? []).map((f) => f.attributes));
    } catch {
      // tolerate individual batch network errors
    }
  }
  return results;
}

// ─── Per-source fetch functions ───────────────────────────────────────────────

/**
 * Fetch MAR Address Points for buildings with >= MIN_UNITS residential units.
 * These are building-level records with direct lat/lng — no polygon join needed.
 *
 * @returns {Promise<Array<BuildingRecord>>}
 */
async function fetchMarBuildings() {
  const features = await fetchAllArcGisFeatures(ENDPOINTS.MAR_ADDRESS_POINTS, {
    where: `RESIDENTIAL_UNIT_COUNT >= ${MIN_UNITS} AND STATUS = 'ACTIVE'`,
    outFields: 'MAR_ID,SSL,ADDRESS,QUADRANT,LATITUDE,LONGITUDE,RESIDENTIAL_TYPE,RESIDENTIAL_UNIT_COUNT,HAS_PLACE_NAME',
  });

  return features.map((f) => {
    const a = f.attributes;
    return {
      id:           `mar-${a.MAR_ID}`,
      marId:        a.MAR_ID != null ? String(Math.round(a.MAR_ID)) : null,
      ssl:          normaliseSSL(a.SSL),
      address:      a.ADDRESS ?? '',
      latitude:     a.LATITUDE,
      longitude:    a.LONGITUDE,
      occupancyType: a.RESIDENTIAL_TYPE ?? null,
      unitCount:    a.RESIDENTIAL_UNIT_COUNT ?? null,
      hasPlaceName: a.HAS_PLACE_NAME === 'Y',
      source:       'DC Master Address Repository',
      name:         null,
      osmName:      null,
      ayb:          null,
    };
  });
}

/**
 * Fetch all active MAR Aliases (official DC place names).
 * When a MAR_ID has multiple aliases we use the first active one encountered.
 *
 * @returns {Promise<Map<string, string>>} marId → name
 */
async function fetchAllMarAliases() {
  const features = await fetchAllArcGisFeatures(ENDPOINTS.MAR_ALIASES, {
    where: "STATUS = 'ACTIVE'",
    outFields: 'MAR_ID,NAME',
  });

  const map = new Map();
  features.forEach((f) => {
    const { MAR_ID, NAME } = f.attributes;
    if (MAR_ID == null || !NAME) return;
    const key = String(Math.round(MAR_ID));
    if (!map.has(key)) map.set(key, NAME);
  });
  return map;
}

/**
 * Fetch DMPED/DHCD Affordable Housing project names (supplemental only).
 * Returns two lookup maps so callers can match by MAR_ID or normalised address.
 *
 * @returns {Promise<{byMarId: Map<string,string>, byAddress: Map<string,string>}>}
 */
async function fetchAffordableHousingNames() {
  const features = await fetchAllArcGisFeatures(ENDPOINTS.AFFORDABLE_HOUSING, {
    outFields: 'MAR_ID,PROJECT_NAME,FULLADDRESS,ADDRESS',
  });

  const byMarId   = new Map();
  const byAddress = new Map();

  features.forEach((f) => {
    const a = f.attributes;
    const name = a.PROJECT_NAME?.trim();
    if (!name) return;
    if (a.MAR_ID != null) byMarId.set(String(Math.round(a.MAR_ID)), name);
    const addr = normaliseAddress(a.FULLADDRESS || a.ADDRESS || '');
    if (addr) byAddress.set(addr, name);
  });

  return { byMarId, byAddress };
}

/**
 * Fetch year-built (AYB) from OTR Commercial CAMA for a list of SSLs.
 * Commercial CAMA covers buildings DC classifies commercially (typically 20+ units).
 *
 * @param {string[]} sslList
 * @returns {Promise<Map<string, number>>} ssl → ayb
 */
async function fetchCamaYearBuilt(sslList) {
  const rows = await batchQueryBySSL(ENDPOINTS.CAMA_COMMERCIAL, sslList, 'SSL,AYB');
  const map = new Map();
  rows.forEach((a) => {
    if (a.SSL && a.AYB) map.set(normaliseSSL(a.SSL), a.AYB);
  });
  return map;
}

/**
 * Proximity-match each building against named OSM buildings within 100 m.
 * Mutates the `osmName` field of each building in-place.
 * Failures are caught and logged — OSM enrichment is best-effort.
 *
 * @param {Array<BuildingRecord>} buildings
 */
async function enrichWithOsm(buildings) {
  try {
    const query = `[out:json][timeout:30];(way[building][name](${DC_BBOX});relation[building][name](${DC_BBOX}););out center tags;`;
    const res = await fetch(ENDPOINTS.OVERPASS, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    });
    const json = await res.json();
    const named = (json.elements ?? [])
      .filter((el) => el.tags?.name && (el.center || el.type === 'node'))
      .map((el) => ({
        name: el.tags.name,
        lat:  el.center?.lat ?? el.lat,
        lng:  el.center?.lon ?? el.lon,
      }));

    buildings.forEach((b) => {
      let best = null, bestDist = 100; // metres threshold
      named.forEach((n) => {
        const dlat = (n.lat - b.latitude)  * 111_000;
        const dlng = (n.lng - b.longitude) * 111_000 * Math.cos(b.latitude * (Math.PI / 180));
        const dist = Math.sqrt(dlat * dlat + dlng * dlng);
        if (dist < bestDist) { bestDist = dist; best = n.name; }
      });
      if (best) b.osmName = best;
    });
  } catch (err) {
    console.warn('[dcApartmentBuildingsService] OSM enrichment skipped:', err.message);
  }
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Group buildings that share the same SSL (parcel ID).
 * Multiple MAR address points can map to a single parcel (e.g. multiple
 * building entrances). We keep the record with the highest unit count and
 * preserve any name that was found.
 *
 * Buildings without an SSL are kept as-is.
 *
 * @param {Array<BuildingRecord>} buildings
 * @returns {Array<BuildingRecord>}
 */
export function deduplicateBySSL(buildings) {
  const bySSL = new Map();
  const noSSL = [];

  buildings.forEach((b) => {
    if (!b.ssl) { noSSL.push(b); return; }
    if (!bySSL.has(b.ssl)) { bySSL.set(b.ssl, { ...b }); return; }
    const existing = bySSL.get(b.ssl);
    if ((b.unitCount ?? 0) > (existing.unitCount ?? 0)) existing.unitCount = b.unitCount;
    if (b.name && !existing.name) existing.name = b.name;
    if (b.hasPlaceName) existing.hasPlaceName = true;
  });

  return [...bySSL.values(), ...noSSL];
}

// ─── GeoJSON serialiser ───────────────────────────────────────────────────────

/**
 * Convert internal building records to a GeoJSON FeatureCollection.
 * Sets `displayName` = name (if available) or title-cased address.
 */
function toGeoJSON(buildings) {
  return {
    type: 'FeatureCollection',
    features: buildings
      .filter((b) => b.latitude && b.longitude)
      .map((b) => {
        const name        = b.name || b.osmName || null;
        const displayName = name || toTitleCase(b.address) || 'Apartment Building';
        const nameSource  = b.name
          ? 'DC MAR / Affordable Housing'
          : b.osmName
            ? 'OpenStreetMap'
            : null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [b.longitude, b.latitude] },
          properties: {
            id:           b.id,
            name,
            displayName,
            address:      toTitleCase(b.address),
            source:       b.source,
            nameSource,
            unitCount:    b.unitCount,
            occupancyType: b.occupancyType,
            ssl:          b.ssl,
            marId:        b.marId,
            ayb:          b.ayb,
          },
        };
      }),
  };
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Fetch, normalise, enrich, and return all DC apartment buildings as a
 * GeoJSON FeatureCollection ready for Leaflet's GeoJSON component.
 *
 * Internal data shape per feature.properties:
 * {
 *   id:           string          — "mar-<MAR_ID>"
 *   name:         string | null   — official or OSM building name
 *   displayName:  string          — name, or title-cased address, or "Apartment Building"
 *   address:      string          — title-cased street address
 *   source:       string          — primary data source label
 *   nameSource:   string | null   — where the name came from
 *   unitCount:    number | null   — residential unit count
 *   occupancyType: string | null  — e.g. "RESIDENTIAL", "MIXED USE"
 *   ssl:          string | null   — DC parcel identifier
 *   marId:        string | null   — MAR address point ID
 *   ayb:          number | null   — actual year built (from OTR CAMA)
 * }
 *
 * @param {(msg: string) => void} [onProgress] — optional status callback
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function fetchApartmentBuildings(onProgress) {
  const report = (msg) => onProgress?.(msg);

  // Step 1 — Primary source: MAR multi-unit residential buildings
  report('Loading building records from DC MAR…');
  const raw = await fetchMarBuildings();

  // Step 2 — Deduplicate by SSL (multiple addresses can share a parcel)
  const buildings = deduplicateBySSL(raw);

  // Step 3 — MAR Aliases: official DC place names (highest priority)
  report('Loading official DC building names…');
  const aliasMap = await fetchAllMarAliases();
  buildings.forEach((b) => {
    if (b.marId && aliasMap.has(b.marId)) b.name = aliasMap.get(b.marId);
  });

  // Step 4 — Affordable Housing: project names as supplemental enrichment
  report('Enriching with affordable housing project names…');
  const { byMarId: ahById, byAddress: ahByAddr } = await fetchAffordableHousingNames();
  buildings.forEach((b) => {
    if (b.name) return;
    b.name = (b.marId ? ahById.get(b.marId) : null)
          ?? ahByAddr.get(normaliseAddress(b.address))
          ?? null;
  });

  // Step 5 — CAMA: year-built for colour coding (best-effort, no AYB = null)
  report('Loading year-built data…');
  const sslList = buildings.filter((b) => b.ssl).map((b) => b.ssl);
  if (sslList.length) {
    const camaMap = await fetchCamaYearBuilt(sslList);
    buildings.forEach((b) => { if (b.ssl) b.ayb = camaMap.get(b.ssl) ?? null; });
  }

  // Step 6 — OSM: final-pass name enrichment for remaining unnamed buildings
  report('Enriching with OpenStreetMap names…');
  await enrichWithOsm(buildings);

  return toGeoJSON(buildings);
}
