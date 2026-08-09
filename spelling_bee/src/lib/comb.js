/**
 * Geometry for a comb built the way a comb is: small hexagons of cells, set
 * slightly apart, arranged into a hexagon themselves.
 *
 * Kept apart from the component because it is pure arithmetic, and it is the
 * only part that can be wrong in a way a screenshot would not show.
 *
 * Everything is measured in cell widths, with the origin at the middle of the
 * comb. The component turns that into percentages once, at the end.
 */

/** A pointy-top hexagon is √3/2 as wide as it is tall. */
export const CELL_H = 2 / Math.sqrt(3);
/** A honeycomb stacks its rows three quarters of a cell height apart. */
const ROW_RISE = 0.75 * CELL_H;

/** Cells per cluster: 19, the hexagon three cells to a side. */
export const CLUSTER_SIDE = 3;
/** Mortar between clusters, in cell widths. */
const GAP = 0.55;

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
 * How many cells a given cell sits from the centre of its hexagon.
 *
 * Row and column are the offset-row coordinates the rows are built in; they
 * convert to cube coordinates, where distance from the origin is half the sum
 * of the absolute components.
 */
export function ring(side, row, col) {
  const z = row - (side - 1);
  const x = -(side - 1) - Math.min(z, 0) + col;
  return (Math.abs(x) + Math.abs(x + z) + Math.abs(z)) / 2;
}

/**
 * Every cell of a hexagon, in the order it should be filled: rings from the
 * centre out, and around each ring by angle.
 *
 * A count almost never lands exactly on a hexagonal number, so the last ring
 * is usually part-full. Going by ring keeps the spare cells on the rim rather
 * than hollowing out whole rows, and going by angle within the ring leaves
 * them as one contiguous arc rather than a cell stranded on its own.
 *
 * Both scales use this: cells within a cluster, and clusters within the comb.
 */
export function orderedCells(side) {
  const cells = [];
  hexRows(side).forEach((length, row) => {
    for (let col = 0; col < length; col++) {
      const angle = Math.atan2((row - (side - 1)) * ROW_RISE, col - (length - 1) / 2);
      cells.push({
        row,
        col,
        r: ring(side, row, col),
        // Walk each ring from the top rather than from the left. Both keep the
        // part-full ring in one contiguous piece, which is what stops anything
        // being stranded on its own; starting at the top is what centres the
        // leftover over the rest instead of hanging it off one flank.
        turn: (angle + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI),
      });
    }
  });
  return cells.sort((a, b) => a.r - b.r || a.turn - b.turn);
}

/** Centre of cell `col` in a centred row of `length`, relative to the hexagon. */
const offsetX = (col, length) => col - (length - 1) / 2;
const offsetY = (row, side) => (row - (side - 1)) * ROW_RISE;

// A cluster's own extent, centre of cell to centre of cell plus half a cell
// at each end, which is what the pitch between clusters has to clear.
const CLUSTER_W = 2 * CLUSTER_SIDE - 1;
const CLUSTER_H = CELL_H + (2 * CLUSTER_SIDE - 2) * ROW_RISE;
const PITCH_X = CLUSTER_W + GAP;
const PITCH_Y = CLUSTER_H + GAP;

/**
 * Where every word's cell sits, and how big the whole comb is.
 *
 * Returns positions in cell widths with the top-left of the comb at the
 * origin, so the caller only has to divide by `width` and `height`.
 */
export function combLayout(count) {
  const per = capacity(CLUSTER_SIDE);
  const clusterCount = Math.ceil(count / per);
  const gridSide = sideFor(clusterCount);
  const gridRows = hexRows(gridSide);
  const withinCluster = orderedCells(CLUSTER_SIDE);
  const clusterRows = hexRows(CLUSTER_SIDE);

  const cells = [];
  orderedCells(gridSide)
    .slice(0, clusterCount)
    .forEach((cluster, c) => {
      // The clusters sit on a lattice of their own, one cluster-plus-mortar
      // to a step, laid out by exactly the same centred rows as the cells.
      const cx = offsetX(cluster.col, gridRows[cluster.row]) * PITCH_X;
      const cy = (cluster.row - (gridSide - 1)) * PITCH_Y;

      withinCluster.slice(0, count - c * per).forEach((cell, i) => {
        cells.push({
          index: c * per + i,
          x: cx + offsetX(cell.col, clusterRows[cell.row]),
          y: cy + offsetY(cell.row, CLUSTER_SIDE),
        });
      });
    });

  const left = Math.min(...cells.map((c) => c.x)) - 0.5;
  const top = Math.min(...cells.map((c) => c.y)) - CELL_H / 2;
  const width = Math.max(...cells.map((c) => c.x)) + 0.5 - left;
  const height = Math.max(...cells.map((c) => c.y)) + CELL_H / 2 - top;

  return {
    width,
    height,
    cells: cells.map((c) => ({ index: c.index, x: c.x - left, y: c.y - top })),
  };
}
