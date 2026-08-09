import assert from "node:assert/strict";
import { test } from "node:test";
import { capacity, hexRows, layout, ring, sideFor } from "./comb.js";

const SIDES = [1, 2, 3, 4, 5, 6, 8, 12];

test("row lengths add up to the hexagon's capacity", () => {
  for (const side of SIDES) {
    const rows = hexRows(side);
    assert.equal(rows.length, 2 * side - 1);
    assert.equal(
      rows.reduce((a, b) => a + b, 0),
      capacity(side),
      `side ${side}`
    );
  }
});

test("consecutive rows differ by exactly one cell", () => {
  // This is what makes centring each row enough to interlock the honeycomb:
  // a row of k lands in the notches of the row of k+1. Any other step would
  // need an explicit half-cell offset.
  for (const side of SIDES.filter((s) => s > 1)) {
    const rows = hexRows(side);
    for (let i = 1; i < rows.length; i++) {
      assert.equal(Math.abs(rows[i] - rows[i - 1]), 1, `side ${side} row ${i}`);
    }
  }
});

test("every cell lands in a real ring, and ring r holds 6r cells", () => {
  for (const side of SIDES) {
    const tally = new Map();
    hexRows(side).forEach((length, row) => {
      for (let col = 0; col < length; col++) {
        const r = ring(side, row, col);
        assert.ok(Number.isInteger(r) && r >= 0 && r < side, `side ${side} ring ${r}`);
        tally.set(r, (tally.get(r) ?? 0) + 1);
      }
    });
    for (const [r, count] of tally) {
      assert.equal(count, r === 0 ? 1 : 6 * r, `side ${side} ring ${r}`);
    }
  }
});

test("the smallest hexagon that fits is never too small, and never a size too big", () => {
  for (const count of [1, 2, 7, 8, 19, 20, 61, 62, 89, 162, 169, 170]) {
    const side = sideFor(count);
    assert.ok(capacity(side) >= count, `${count} does not fit side ${side}`);
    assert.ok(side === 1 || capacity(side - 1) < count, `${count} would fit side ${side - 1}`);
  }
});

test("words fill from the centre out, so spare cells are all on the outer ring", () => {
  const words = Array.from({ length: 62 }, (_, i) => `w${i}`);
  const side = sideFor(words.length); // 6 — a 91-cell hexagon
  const placed = layout(words, side);

  assert.equal(placed.size, words.length);
  assert.equal(placed.get(`${side - 1},${side - 1}`), "w0"); // centre cell first

  // 62 words fill rings 0-4 completely (61 cells) and one cell of ring 5.
  const rings = [...placed.keys()].map((key) => {
    const [row, col] = key.split(",").map(Number);
    return ring(side, row, col);
  });
  assert.equal(rings.filter((r) => r < 5).length, 61);
  assert.equal(rings.filter((r) => r === 5).length, 1);
});

test("an exact hexagonal count leaves no cell empty", () => {
  const words = Array.from({ length: 61 }, (_, i) => `w${i}`);
  const side = sideFor(words.length);
  assert.equal(capacity(side), 61);
  assert.equal(layout(words, side).size, 61);
});
