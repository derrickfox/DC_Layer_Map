import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  LOCKED_NEIGHBORHOOD_ALIASES,
  LOCKED_NEIGHBORHOOD_ANCHORS
} from '../src/data/lockedNeighborhoodAnchors.js';

/**
 * Canonicalize object keys recursively so JSON diffing is deterministic.
 */
const sortDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key]);
    return out;
  }
  return value;
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(rootDir, 'scripts', 'locked-neighborhood-anchors.baseline.json');

const current = sortDeep({
  anchors: LOCKED_NEIGHBORHOOD_ANCHORS,
  aliases: LOCKED_NEIGHBORHOOD_ALIASES
});
const currentJson = `${JSON.stringify(current, null, 2)}\n`;

const shouldUpdate = process.argv.includes('--update');

if (shouldUpdate) {
  fs.writeFileSync(baselinePath, currentJson, 'utf8');
  console.log(`Updated baseline: ${baselinePath}`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error('Missing locked neighborhood baseline.');
  console.error('Run: npm run anchors:update-baseline');
  process.exit(1);
}

const baselineRaw = fs.readFileSync(baselinePath, 'utf8');
const baselineJson = `${JSON.stringify(sortDeep(JSON.parse(baselineRaw)), null, 2)}\n`;

if (baselineJson !== currentJson) {
  console.error('Locked neighborhood anchors changed without baseline update.');
  console.error('If intentional, run: npm run anchors:update-baseline');
  process.exit(1);
}

console.log('Locked neighborhood anchors verified.');

