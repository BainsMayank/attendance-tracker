import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = readFileSync(resolve(root, '../src/ui/tokens.ts'), 'utf8');
function object(name) {
  const literal = tokens.match(new RegExp(`export const ${name}(?:[^=]*)= (\\{[\\s\\S]*?\\n\\})`))?.[1];
  if (!literal) throw new Error(`Missing theme token ${name}`);
  return Function(`"use strict";return (${literal})`)();
}
const brand = {
  name: 'BunkBuddy', tagline: 'Know your safe skips.',
  sources: ['src/ui/tokens.ts', 'src/features/settings/model.ts', 'src/ui/text.tsx', 'docs/DESIGN.md', 'design/refs/README.md', 'app.json'],
  decision: 'Current implemented light tokens and the superseding calm redesign take precedence over older design mockups. Default persisted accent indigo is displayed as Ink.',
  colors: object('light'), darkColors: object('dark'),
  graphicMint: object('dark').present,
  mintSource: 'The real dark-theme present token; use light-theme present for dark text and status marks.',
  radii: object('radii'), spacing: object('spacing'), typography: object('type'),
  fonts: { app: 'Native platform system sans-serif; no bundled custom font or fontFamily override', android: 'Roboto', graphics: 'Roboto, extracted from the capture emulator; bundled under source/fonts with Apache License 2.0 as identified in the font metadata', weights: [400, 500, 600, 700], numerals: 'tabular' },
  adaptiveBackground: object('light').accent,
  adaptiveSafeZone: { canvas: 1024, maximumCentralFraction: 0.66, symbolBounds: [256, 256, 768, 768], note: 'Symbol fits within the central 50% square and within the Android circular safe zone.' },
  screenshotComposition: { width: 1080, height: 1920, screenshotWidth: 842, screenshotHeight: 1497, top: 350, headlineBand: 300, border: 2, screenshotTreatment: 'Uniform resize only; no UI redraw, pixel editing, crop, or rounded clipping' },
  featureGraphic: { width: 1024, height: 500, safeMarginFraction: 0.08, ringValue: 82, ringNote: 'Illustrative brand graphic, not a screenshot or a claim about the fictional demo totals' },
};
writeFileSync(resolve(root, 'brand.json'), JSON.stringify(brand, null, 2)+'\n');
console.log('Extracted current app tokens → store-assets/brand.json');
