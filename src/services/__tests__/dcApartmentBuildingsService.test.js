import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toTitleCase,
  normaliseSSL,
  normaliseAddress,
  deduplicateBySSL,
  fetchAllArcGisFeatures,
  ENDPOINTS,
  MIN_UNITS,
} from '../dcApartmentBuildingsService.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeBuilding = (overrides = {}) => ({
  id:           'mar-12345',
  marId:        '12345',
  ssl:          '0135    0004',
  address:      '1500 NEW HAMPSHIRE AVENUE NW',
  latitude:     38.9171,
  longitude:    -77.0419,
  occupancyType: 'RESIDENTIAL',
  unitCount:    314,
  hasPlaceName: false,
  source:       'DC Master Address Repository',
  name:         null,
  osmName:      null,
  ayb:          null,
  ...overrides,
});

const makeArcGisResponse = (features, exceededTransferLimit = false) => ({
  ok: true,
  json: async () => ({ features, exceededTransferLimit }),
});

const makeArcGisErrorResponse = (code, message) => ({
  ok: true,
  json: async () => ({ error: { code, message } }),
});

// ─── toTitleCase ─────────────────────────────────────────────────────────────

describe('toTitleCase', () => {
  it('converts all-caps DC address', () => {
    expect(toTitleCase('1500 NEW HAMPSHIRE AVENUE NW')).toBe('1500 New Hampshire Avenue NW');
  });

  it('preserves all four quadrant abbreviations', () => {
    expect(toTitleCase('100 MAIN ST NE')).toBe('100 Main St NE');
    expect(toTitleCase('200 OAK DR SW')).toBe('200 Oak Dr SW');
    expect(toTitleCase('300 ELM AVE SE')).toBe('300 Elm Ave SE');
    expect(toTitleCase('400 PINE RD NW')).toBe('400 Pine Rd NW');
  });

  it('returns empty string for falsy input', () => {
    expect(toTitleCase('')).toBe('');
    expect(toTitleCase(null)).toBe('');
    expect(toTitleCase(undefined)).toBe('');
  });
});

// ─── normaliseSSL ─────────────────────────────────────────────────────────────

describe('normaliseSSL', () => {
  it('trims surrounding whitespace', () => {
    expect(normaliseSSL('  0135    0004  ')).toBe('0135    0004');
  });

  it('preserves internal spaces (SSL format has embedded spaces)', () => {
    expect(normaliseSSL('0135    0004')).toBe('0135    0004');
  });

  it('returns null for null input', () => {
    expect(normaliseSSL(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normaliseSSL('')).toBeNull();
  });
});

// ─── normaliseAddress ─────────────────────────────────────────────────────────

describe('normaliseAddress', () => {
  it('upper-cases and collapses spaces', () => {
    expect(normaliseAddress('1500 New Hampshire  Avenue NW')).toBe('1500 NEW HAMPSHIRE AVENUE NW');
  });

  it('returns empty string for falsy input', () => {
    expect(normaliseAddress('')).toBe('');
    expect(normaliseAddress(null)).toBe('');
  });
});

// ─── deduplicateBySSL ─────────────────────────────────────────────────────────

describe('deduplicateBySSL', () => {
  it('merges two buildings with the same SSL into one', () => {
    const a = makeBuilding({ id: 'mar-1', unitCount: 50 });
    const b = makeBuilding({ id: 'mar-2', unitCount: 80 });
    expect(deduplicateBySSL([a, b])).toHaveLength(1);
  });

  it('keeps the higher unit count when merging', () => {
    const a = makeBuilding({ unitCount: 50 });
    const b = makeBuilding({ unitCount: 80 });
    const [result] = deduplicateBySSL([a, b]);
    expect(result.unitCount).toBe(80);
  });

  it('keeps buildings without SSL as separate entries', () => {
    const a = makeBuilding({ ssl: null, id: 'mar-1' });
    const b = makeBuilding({ ssl: null, id: 'mar-2' });
    expect(deduplicateBySSL([a, b])).toHaveLength(2);
  });

  it('promotes name from a named duplicate onto the surviving record', () => {
    const unnamed = makeBuilding({ id: 'mar-1', name: null });
    const named   = makeBuilding({ id: 'mar-2', name: 'Hampshire Arms' });
    const [result] = deduplicateBySSL([unnamed, named]);
    expect(result.name).toBe('Hampshire Arms');
  });

  it('keeps distinct SSLs as separate buildings', () => {
    const a = makeBuilding({ ssl: '0135    0004' });
    const b = makeBuilding({ ssl: '0135    0005', id: 'mar-99' });
    expect(deduplicateBySSL([a, b])).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateBySSL([])).toHaveLength(0);
  });
});

// ─── displayName fallback logic ───────────────────────────────────────────────

describe('displayName fallback', () => {
  const computeDisplayName = (b) =>
    b.name || b.osmName || toTitleCase(b.address) || 'Apartment Building';

  it('uses name when available', () => {
    const b = makeBuilding({ name: 'The Hampshire' });
    expect(computeDisplayName(b)).toBe('The Hampshire');
  });

  it('prefers name over osmName', () => {
    const b = makeBuilding({ name: 'The Hampshire', osmName: 'Hampshire Arms OSM' });
    expect(computeDisplayName(b)).toBe('The Hampshire');
  });

  it('falls back to osmName when name is null', () => {
    const b = makeBuilding({ name: null, osmName: 'Hampshire Arms OSM' });
    expect(computeDisplayName(b)).toBe('Hampshire Arms OSM');
  });

  it('falls back to title-cased address when neither name nor osmName', () => {
    const b = makeBuilding({ name: null, osmName: null, address: '1500 NEW HAMPSHIRE AVENUE NW' });
    expect(computeDisplayName(b)).toBe('1500 New Hampshire Avenue NW');
  });

  it('falls back to generic label when address is also missing', () => {
    const b = makeBuilding({ name: null, osmName: null, address: '' });
    expect(computeDisplayName(b)).toBe('Apartment Building');
  });
});

// ─── fetchAllArcGisFeatures — error handling ──────────────────────────────────

describe('fetchAllArcGisFeatures', () => {
  beforeEach(() => { vi.spyOn(globalThis, 'fetch'); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('throws on non-2xx HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchAllArcGisFeatures('https://example.com/layer'))
      .rejects.toThrow('ArcGIS HTTP 500');
  });

  it('throws on ArcGIS-level error in JSON body', async () => {
    vi.mocked(fetch).mockResolvedValue(makeArcGisErrorResponse(400, 'Invalid query'));
    await expect(fetchAllArcGisFeatures('https://example.com/layer'))
      .rejects.toThrow('ArcGIS error 400: Invalid query');
  });

  it('returns all features from a single page response', async () => {
    const mockFeatures = [{ attributes: { FOO: 1 } }, { attributes: { FOO: 2 } }];
    vi.mocked(fetch).mockResolvedValue(makeArcGisResponse(mockFeatures));
    const result = await fetchAllArcGisFeatures('https://example.com/layer');
    expect(result).toHaveLength(2);
    expect(result[0].attributes.FOO).toBe(1);
  });

  it('follows pagination when exceededTransferLimit is true', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ attributes: { N: i } }));
    const page2 = [{ attributes: { N: 1000 } }];
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ features: page1, exceededTransferLimit: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ features: page2, exceededTransferLimit: false }) });
    const result = await fetchAllArcGisFeatures('https://example.com/layer');
    expect(result).toHaveLength(1001);
  });

  it('returns empty array when features field is missing', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ exceededTransferLimit: false }),
    });
    const result = await fetchAllArcGisFeatures('https://example.com/layer');
    expect(result).toHaveLength(0);
  });
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe('ENDPOINTS', () => {
  it('all endpoints are non-empty strings', () => {
    Object.entries(ENDPOINTS).forEach(([, url]) => {
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(10);
    });
  });

  it('MAR_ADDRESS_POINTS points to the Location MapServer', () => {
    expect(ENDPOINTS.MAR_ADDRESS_POINTS).toContain('Location_WebMercator');
  });

  it('MAR_ALIASES points to layer 3', () => {
    expect(ENDPOINTS.MAR_ALIASES).toContain('MapServer/3');
  });

  it('CAMA_COMMERCIAL points to layer 23', () => {
    expect(ENDPOINTS.CAMA_COMMERCIAL).toContain('MapServer/23');
  });
});

describe('MIN_UNITS', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(MIN_UNITS)).toBe(true);
    expect(MIN_UNITS).toBeGreaterThan(0);
  });
});
