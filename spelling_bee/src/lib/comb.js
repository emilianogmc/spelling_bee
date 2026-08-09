/**
 * Geometry for a comb shaped like a comb cell: a hexagon built out of
 * hexagons, one per word.
 *
 * Kept apart from the component because it is pure arithmetic and it is the
 * only part that can be wrong in a way a screenshot would not show.
 */

/** Cells in a hexagon `side` cells to an edge: 1, 7, 19, 37, 61, 91, 127… */
export const capacity = (side) => 3 * side * side - 3 * side + 1;

/** The smallest hexagon that holds `count` cells. */
export function sideFor(count) {
  let side = 1;
  while (capacity(side) < count) side++;
  return side;
}

/** Row lengths, widest in the middle: side, side+1, … 2·side-1, … side. */
export const hexRows = (side) =>
  Array.from({ length: 2 * side - 1 }, (_, i) => (i < side ? side + i : 3 * side - 2 - i));

/**
 * How many cells a given cell sits from the centre of the comb.
 *
 * Row and column are the offset-row coordinates the markup renders in; they
 * are converted to cube coordinates, where the distance from the origin is
 * half the sum of the absolute components.
 */
export function ring(side, row, col) {
  const z = row - (side - 1);
  const x = -(side - 1) - Math.min(z, 0) + col;
  return (Math.abs(x) + Math.abs(x + z) + Math.abs(z)) / 2;
}

/**
 * Which cell holds which word, filled from the centre outwards, keyed
 * "row,col".
 *
 * A word list almost never lands exactly on a hexagonal number, so some cells
 * are always spare. Filling row by row put every spare one at the bottom and
 * hollowed out whole rows; filling by ring confines them to the outer edge, so
 * a part-full comb still reads as a smaller solid one.
 */
export function layout(words, side) {
  const cells = [];
  hexRows(side).forEach((length, row) => {
    for (let col = 0; col < length; col++) {
      // Position relative to the centre, in cell widths. Rows sit 0.866 of a
      // width apart, being three quarters of a cell height.
      const x = col - (length - 1) / 2;
      const y = (row - (side - 1)) * 0.866;
      cells.push({ row, col, r: ring(side, row, col), angle: Math.atan2(y, x) });
    }
  });

  // Rings first, then around each ring. Ordering the last, part-filled ring by
  // angle leaves its spare cells as one contiguous arc on the rim. Ordering it
  // by row instead emptied whole rows, which for the default list left a
  // single cell dangling below an otherwise complete comb.
  cells.sort((a, b) => a.r - b.r || a.angle - b.angle);

  const placed = new Map();
  cells.slice(0, words.length).forEach(({ row, col }, i) => placed.set(`${row},${col}`, words[i]));
  return placed;
}
