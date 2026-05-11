/**
 * Locked neighborhood anchor coordinates.
 *
 * IMPORTANT PROCEDURE FOR HUMAN/AI EDITORS:
 * 1) Treat this file as the single source of truth for manually tuned neighborhood label anchors.
 * 2) Only change coordinates after visual verification against the live basemap.
 * 3) After intentional edits, run:
 *      npm run anchors:update-baseline
 *    This refreshes the verification baseline file.
 * 4) Commit BOTH:
 *    - this file
 *    - scripts/locked-neighborhood-anchors.baseline.json
 * 5) If you change one without the other, `npm run build` will fail by design.
 *
 * Why this exists:
 * - Tile label placement can shift over time.
 * - Fallback OSM matching can introduce subtle drift.
 * - We need explicit, reviewable, deterministic anchors for known neighborhoods.
 */
export const LOCKED_NEIGHBORHOOD_ANCHORS = Object.freeze({
  "Adams Morgan": { center: [38.9215002, -77.0421992], radius: 500 },
  "American University Park": { center: [38.9514996, -77.0899781], radius: 500 },
  "BellAir": { center: [38.9328, -76.9933], radius: 390 },
  "Bloomingdale": { center: [38.9167782, -77.0113652], radius: 450 },
  "Brightwood": { center: [38.9656333, -77.0271149], radius: 430 },
  "Burleith/Hillandale": { center: [38.9146516, -77.0736641], radius: 420 },
  "Capitol Hill": { center: [38.8890009, -77.0002537], radius: 450 },
  "Cardozo/Shaw": { center: [38.9172239, -77.0282196], radius: 450 },
  "Carver": { center: [38.9039499, -76.9776375], radius: 380 },
  "Columbia Heights": { center: [38.9256753, -77.0296598], radius: 500 },
  "Downtown": { center: [38.8994909, -77.0280672], radius: 460 },
  "Dupont Circle": { center: [38.9109436, -77.0427259], radius: 480 },
  "Edgewood": { center: [38.9226131, -77.0005375], radius: 430 },
  "Forest Hills": { center: [38.9509441, -77.0580329], radius: 450 },
  "Foxhall Crescent": { center: [38.9231668, -77.0922004], radius: 420 },
  "Foxhall Village": { center: [38.9117781, -77.0844224], radius: 420 },
  "Georgetown": { center: [38.9087134, -77.0653494], radius: 550 },
  "Kalorama Heights": { center: [38.9183738, -77.0480828], radius: 450 },
  "Kingman Park": { center: [38.8966073, -76.9782112], radius: 420 },
  "Lamond Riggs": { center: [38.9664995, -77.0074764], radius: 430 },
  "Lanier Heights": { center: [38.9265002, -77.039977], radius: 420 },
  "Le Droit Park": { center: [38.9159068, -77.0157211], radius: 430 },
  "Michigan Park": { center: [38.9469841, -76.9935758], radius: 420 },
  "Mt. Pleasant": { center: [38.9309121, -77.0382234], radius: 450 },
  "Navy Yard": { center: [38.8741823, -77.0005122], radius: 420 },
  "Palisades": { center: [38.9251112, -77.1013673], radius: 440 },
  "Park View": { center: [38.9334691, -77.0213014], radius: 430 },
  "Penn Quarters": { center: [38.8958959, -77.022268], radius: 440 },
  "Pleasant Plains": { center: [38.9293745, -77.0228255], radius: 400 },
  "Spring Valley": { center: [38.9395553, -77.0988672], radius: 440 },
  "Truxton Circle": { center: [38.9098338, -77.0149764], radius: 450 },
  "University Heights": { center: [38.9398333, -76.9935871], radius: 420 },
  "West End": { center: [38.907056, -77.0496994], radius: 420 },
  "Wesley Heights": { center: [38.9312222, -77.0880336], radius: 420 },
  "Woodley Park": { center: [38.9250248, -77.0523627], radius: 550 }
});

/**
 * Alias map for alternate spellings/legacy names that must resolve to a locked key.
 *
 * IMPORTANT:
 * - Keys are observed incoming names.
 * - Values are canonical keys in LOCKED_NEIGHBORHOOD_ANCHORS.
 */
export const LOCKED_NEIGHBORHOOD_ALIASES = Object.freeze({
  "Lamont Riggs": "Lamond Riggs",
  "Bellair": "BellAir",
  "Bell Air": "BellAir",
  "Burleith": "Burleith/Hillandale",
  "Burleith / Hillandale": "Burleith/Hillandale",
  "The Palisades": "Palisades",
  "Penn Quarter": "Penn Quarters"
});

