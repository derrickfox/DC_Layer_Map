// AI_CHANGE:
// Tool: Codex
// Model: GPT-5
// Timestamp: 2026-05-31T10:27:22-04:00
// Purpose: Provides a curated DC hotel point layer with representative nightly rate estimates.
// Reason: The Hotels layer needs stable local data so it can color-code cheaper hotels red and more expensive hotels green without depending on live booking APIs.
const hotelsData = {
  type: 'FeatureCollection',
  properties: {
    priceBasis: 'Representative nightly USD estimate, before taxes and fees',
    updated: '2026-05-31'
  },
  features: [
    { type: 'Feature', properties: { NAME: 'Four Seasons Hotel Washington, DC', TIER: 'Ultra Luxury', ESTIMATED_RATE_USD: 950, NEIGHBORHOOD: 'Georgetown', ADDRESS: '2800 Pennsylvania Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0570, 38.9049] } },
    { type: 'Feature', properties: { NAME: 'Rosewood Washington, D.C.', TIER: 'Ultra Luxury', ESTIMATED_RATE_USD: 900, NEIGHBORHOOD: 'Georgetown', ADDRESS: '1050 31st St NW' }, geometry: { type: 'Point', coordinates: [-77.0607, 38.9048] } },
    { type: 'Feature', properties: { NAME: 'The Hay-Adams', TIER: 'Ultra Luxury', ESTIMATED_RATE_USD: 850, NEIGHBORHOOD: 'Lafayette Square', ADDRESS: '800 16th St NW' }, geometry: { type: 'Point', coordinates: [-77.0365, 38.9005] } },
    { type: 'Feature', properties: { NAME: 'Salamander Washington DC', TIER: 'Ultra Luxury', ESTIMATED_RATE_USD: 800, NEIGHBORHOOD: 'Southwest Waterfront', ADDRESS: '1330 Maryland Ave SW' }, geometry: { type: 'Point', coordinates: [-77.0318, 38.8847] } },
    { type: 'Feature', properties: { NAME: 'The Jefferson, Washington, DC', TIER: 'Luxury', ESTIMATED_RATE_USD: 780, NEIGHBORHOOD: 'Dupont Circle', ADDRESS: '1200 16th St NW' }, geometry: { type: 'Point', coordinates: [-77.0362, 38.9060] } },
    { type: 'Feature', properties: { NAME: 'Pendry Washington DC - The Wharf', TIER: 'Luxury', ESTIMATED_RATE_USD: 700, NEIGHBORHOOD: 'The Wharf', ADDRESS: '655 Water St SW' }, geometry: { type: 'Point', coordinates: [-77.0216, 38.8795] } },
    { type: 'Feature', properties: { NAME: 'Conrad Washington, DC', TIER: 'Luxury', ESTIMATED_RATE_USD: 650, NEIGHBORHOOD: 'Downtown', ADDRESS: '950 New York Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0249, 38.9015] } },
    { type: 'Feature', properties: { NAME: 'Willard InterContinental Washington, D.C.', TIER: 'Luxury', ESTIMATED_RATE_USD: 650, NEIGHBORHOOD: 'Penn Quarter', ADDRESS: '1401 Pennsylvania Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0320, 38.8970] } },
    { type: 'Feature', properties: { NAME: 'Riggs Washington DC', TIER: 'Luxury', ESTIMATED_RATE_USD: 600, NEIGHBORHOOD: 'Penn Quarter', ADDRESS: '900 F St NW' }, geometry: { type: 'Point', coordinates: [-77.0249, 38.8974] } },
    { type: 'Feature', properties: { NAME: 'Hotel Washington', TIER: 'Upscale', ESTIMATED_RATE_USD: 550, NEIGHBORHOOD: 'Downtown', ADDRESS: '515 15th St NW' }, geometry: { type: 'Point', coordinates: [-77.0339, 38.8965] } },
    { type: 'Feature', properties: { NAME: 'JW Marriott Washington, DC', TIER: 'Upscale', ESTIMATED_RATE_USD: 430, NEIGHBORHOOD: 'Penn Quarter', ADDRESS: '1331 Pennsylvania Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0308, 38.8961] } },
    { type: 'Feature', properties: { NAME: 'Marriott Marquis Washington, DC', TIER: 'Upscale', ESTIMATED_RATE_USD: 420, NEIGHBORHOOD: 'Mount Vernon Square', ADDRESS: '901 Massachusetts Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0237, 38.9040] } },
    { type: 'Feature', properties: { NAME: 'The Dupont Circle Hotel', TIER: 'Upscale', ESTIMATED_RATE_USD: 400, NEIGHBORHOOD: 'Dupont Circle', ADDRESS: '1500 New Hampshire Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0427, 38.9096] } },
    { type: 'Feature', properties: { NAME: 'The Mayflower Hotel', TIER: 'Upscale', ESTIMATED_RATE_USD: 380, NEIGHBORHOOD: 'Downtown', ADDRESS: '1127 Connecticut Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0403, 38.9044] } },
    { type: 'Feature', properties: { NAME: 'The LINE DC', TIER: 'Upscale', ESTIMATED_RATE_USD: 350, NEIGHBORHOOD: 'Adams Morgan', ADDRESS: '1770 Euclid St NW' }, geometry: { type: 'Point', coordinates: [-77.0416, 38.9232] } },
    { type: 'Feature', properties: { NAME: 'Viceroy Washington DC', TIER: 'Upper Midscale', ESTIMATED_RATE_USD: 330, NEIGHBORHOOD: 'Logan Circle', ADDRESS: '1430 Rhode Island Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0331, 38.9083] } },
    { type: 'Feature', properties: { NAME: 'Omni Shoreham Hotel', TIER: 'Upper Midscale', ESTIMATED_RATE_USD: 320, NEIGHBORHOOD: 'Woodley Park', ADDRESS: '2500 Calvert St NW' }, geometry: { type: 'Point', coordinates: [-77.0527, 38.9233] } },
    { type: 'Feature', properties: { NAME: 'Eaton DC', TIER: 'Upper Midscale', ESTIMATED_RATE_USD: 300, NEIGHBORHOOD: 'Downtown', ADDRESS: '1201 K St NW' }, geometry: { type: 'Point', coordinates: [-77.0284, 38.9023] } },
    { type: 'Feature', properties: { NAME: 'Hyatt Place Washington DC / National Mall', TIER: 'Midscale', ESTIMATED_RATE_USD: 260, NEIGHBORHOOD: 'Southwest Federal Center', ADDRESS: '400 E St SW' }, geometry: { type: 'Point', coordinates: [-77.0176, 38.8853] } },
    { type: 'Feature', properties: { NAME: 'Phoenix Park Hotel', TIER: 'Midscale', ESTIMATED_RATE_USD: 250, NEIGHBORHOOD: 'Capitol Hill', ADDRESS: '520 North Capitol St NW' }, geometry: { type: 'Point', coordinates: [-77.0093, 38.8970] } },
    { type: 'Feature', properties: { NAME: 'Moxy Washington, DC Downtown', TIER: 'Midscale', ESTIMATED_RATE_USD: 240, NEIGHBORHOOD: 'Downtown', ADDRESS: '1011 K St NW' }, geometry: { type: 'Point', coordinates: [-77.0260, 38.9025] } },
    { type: 'Feature', properties: { NAME: 'Tabard Inn', TIER: 'Midscale', ESTIMATED_RATE_USD: 230, NEIGHBORHOOD: 'Dupont Circle', ADDRESS: '1739 N St NW' }, geometry: { type: 'Point', coordinates: [-77.0396, 38.9077] } },
    { type: 'Feature', properties: { NAME: 'citizenM Washington DC NoMa', TIER: 'Midscale', ESTIMATED_RATE_USD: 230, NEIGHBORHOOD: 'NoMa', ADDRESS: '1222 1st St NE' }, geometry: { type: 'Point', coordinates: [-77.0067, 38.9063] } },
    { type: 'Feature', properties: { NAME: 'Washington Plaza Hotel', TIER: 'Midscale', ESTIMATED_RATE_USD: 220, NEIGHBORHOOD: 'Thomas Circle', ADDRESS: '10 Thomas Circle NW' }, geometry: { type: 'Point', coordinates: [-77.0317, 38.9057] } },
    { type: 'Feature', properties: { NAME: 'YOTEL Washington DC', TIER: 'Value', ESTIMATED_RATE_USD: 210, NEIGHBORHOOD: 'Capitol Hill', ADDRESS: '415 New Jersey Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0113, 38.8956] } },
    { type: 'Feature', properties: { NAME: 'Motto by Hilton Washington DC City Center', TIER: 'Value', ESTIMATED_RATE_USD: 190, NEIGHBORHOOD: 'Penn Quarter', ADDRESS: '627 H St NW' }, geometry: { type: 'Point', coordinates: [-77.0208, 38.8997] } },
    { type: 'Feature', properties: { NAME: 'Comfort Inn Downtown DC / Convention Center', TIER: 'Value', ESTIMATED_RATE_USD: 180, NEIGHBORHOOD: 'Logan Circle', ADDRESS: '1201 13th St NW' }, geometry: { type: 'Point', coordinates: [-77.0296, 38.9060] } },
    { type: 'Feature', properties: { NAME: 'Hotel Hive', TIER: 'Budget', ESTIMATED_RATE_USD: 170, NEIGHBORHOOD: 'Foggy Bottom', ADDRESS: '2224 F St NW' }, geometry: { type: 'Point', coordinates: [-77.0502, 38.8972] } },
    // AI_CHANGE:
    // Tool: Codex
    // Model: GPT-5
    // Timestamp: 2026-05-31T10:41:35-04:00
    // Purpose: Adds the former Savoy Suites location under its current Glover Park Hotel Georgetown name.
    // Reason: Users expect the old Savoy hotel at Wisconsin and Calvert to appear in the Hotels layer and be searchable by either name.
    { type: 'Feature', properties: { NAME: 'Glover Park Hotel Georgetown', FORMER_NAME: 'Savoy Suites Hotel', TIER: 'Value', ESTIMATED_RATE_USD: 185, NEIGHBORHOOD: 'Glover Park', ADDRESS: '2505 Wisconsin Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0727068824437, 38.92323595] } },
    { type: 'Feature', properties: { NAME: 'Generator Hotel Washington DC', TIER: 'Budget', ESTIMATED_RATE_USD: 150, NEIGHBORHOOD: 'Dupont Circle', ADDRESS: '1900 Connecticut Ave NW' }, geometry: { type: 'Point', coordinates: [-77.0458, 38.9163] } }
  ]
};

export default hotelsData;
