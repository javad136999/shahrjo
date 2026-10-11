import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The city picker card must paint above the city map.
 *
 * The map keeps its own layers (category bar z-index 1200, its menu 1300 and
 * the leaflet panes). Because `.city-map` creates no stacking context by
 * itself, those layers escaped into the root stacking context and covered the
 * lower half of the picker card — which is exactly the "the bottom of the card
 * goes under the map" bug. So we pin both halves of the fix in CSS:
 *   1. `.city-map` isolates its layers,
 *   2. the picker overlay sits above the map's highest layer.
 */
const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

/** All declarations for a selector, across every rule that uses it. */
function rule(selector: string): string {
  const re = new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, '\\.')} \\{`, 'g');
  const blocks: string[] = [];
  for (const m of css.matchAll(re)) {
    const open = css.indexOf('{', m.index);
    blocks.push(css.slice(open + 1, css.indexOf('}', open)));
  }
  expect(blocks.length).toBeGreaterThan(0);
  return blocks.join('\n');
}

function zIndex(block: string): number {
  const m = block.match(/z-index:\s*(\d+)/);
  expect(m).not.toBeNull();
  return Number(m![1]);
}

describe('city picker layering', () => {
  it('keeps the map layers inside .city-map', () => {
    expect(rule('.city-map')).toMatch(/isolation:\s*isolate/);
  });

  it('renders the picker overlay above every map layer', () => {
    const overlay = zIndex(rule('.city-picker-overlay'));
    expect(overlay).toBeGreaterThan(zIndex(rule('.map-catbar')));
    expect(overlay).toBeGreaterThan(zIndex(rule('.map-catmenu')));
  });

  it('keeps the card narrow — a search box, not a full-width panel', () => {
    const width = rule('.city-picker').match(/width:\s*min\(100%,\s*(\d+)px\)/);
    expect(width).not.toBeNull();
    expect(Number(width![1])).toBeLessThanOrEqual(400);
  });
});
