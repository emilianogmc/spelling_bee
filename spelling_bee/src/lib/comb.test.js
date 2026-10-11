import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CELL_H,
  CLUSTER_SIDE,
  LATTICE,
  SEAM,
  capacity,
  combLayout,
  hexRows,
  orderedCells,
  ring,
  sideFor,
} from "./comb.js";

const SIDES = [1, 2, 3, 4, 5, 6, 8, 12];
const COUNTS = [1, 2, 7, 19, 20, 38, 61, 62, 89, 133, 162, 169, 300];

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
  // Why centring a row is enough to interlock it with its neighbours: a row of
  // k lands in the notches of the row of k+1. Any other step would need an
  // explicit half-cell offset.
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

test("fill order visits every cell once, centre first, rings outward", () => {
  for (const side of SIDES) {
    const cells = orderedCells(side);
    assert.equal(cells.length, capacity(side), `side ${side}`);
    assert.equal(new Set(cells.map((c) => `${c.row},${c.col}`)).size, capacity(side));
    assert.equal(cells[0].r, 0);
    for (let i = 1; i < cells.length; i++) {
      assert.ok(cells[i].r >= cells[i - 1].r, `side ${side} went back inwards at ${i}`);
    }
  }
});

test("a part-full ring stays in one contiguous piece", () => {
  // What stops a cluster being stranded away from the rest. Every cell of a
  // part-full ring must touch the one picked before it, at any fill level.
  const side = 4;
  const ringCells = orderedCells(side).filter((c) => c.r === side - 1);
  const rows = hexRows(side);
  const centre = (c) => [
    c.col - (rows[c.row] - 1) / 2,
    (c.row - (side - 1)) * (2 / Math.sqrt(3)) * 0.75,
  ];

  for (let i = 1; i < ringCells.length; i++) {
    const [ax, ay] = centre(ringCells[i]);
    const nearest = Math.min(
      ...ringCells.slice(0, i).map((prev) => {
        const [bx, by] = centre(prev);
        return Math.hypot(ax - bx, ay - by);
      })
    );
    assert.ok(nearest < 1.01, `pick ${i} landed ${nearest.toFixed(2)} from anything before it`);
  }
});

test("the smallest hexagon that fits is never too small, nor a size too big", () => {
  for (const count of COUNTS) {
    const side = sideFor(count);
    assert.ok(capacity(side) >= count, `${count} does not fit side ${side}`);
    assert.ok(side === 1 || capacity(side - 1) < count, `${count} would fit side ${side - 1}`);
  }
});

test("the comb places every word exactly once", () => {
  for (const count of COUNTS) {
    const { cells } = combLayout(count);
    assert.equal(cells.length, count, `count ${count}`);
    assert.deepEqual(
      cells.map((c) => c.index).sort((a, b) => a - b),
      Array.from({ length: count }, (_, i) => i),
      `count ${count}`
    );
  }
});

test("the cluster lattice tiles the plane exactly", () => {
  // The property the whole interlock rests on: repeat one cluster across the
  // lattice and every cell is claimed once. A wrong lattice vector either
  // overlaps clusters or leaves holes between them, and both look like a bug
  // long before anyone works out which.
  const base = [];
  for (let q = -CLUSTER_SIDE; q <= CLUSTER_SIDE; q++) {
    for (let r = -CLUSTER_SIDE; r <= CLUSTER_SIDE; r++) {
      if ((Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2 <= CLUSTER_SIDE - 1) base.push([q, r]);
    }
  }
  assert.equal(base.length, capacity(CLUSTER_SIDE));
  assert.equal(
    LATTICE[0][0] * LATTICE[1][1] - LATTICE[0][1] * LATTICE[1][0],
    capacity(CLUSTER_SIDE),
    "lattice determinant must equal the cells per cluster"
  );

  const claims = new Map();
  for (let m = -6; m <= 6; m++) {
    for (let n = -6; n <= 6; n++) {
      const cq = m * LATTICE[0][0] + n * LATTICE[1][0];
      const cr = m * LATTICE[0][1] + n * LATTICE[1][1];
      for (const [q, r] of base) {
        const key = `${cq + q},${cr + r}`;
        claims.set(key, (claims.get(key) ?? 0) + 1);
      }
    }
  }
  // Judge only well inside the sampled patch, away from its ragged edge.
  for (let q = -10; q <= 10; q++) {
    for (let r = -10; r <= 10; r++) {
      if ((Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2 > 8) continue;
      assert.equal(claims.get(`${q},${r}`) ?? 0, 1, `cell ${q},${r}`);
    }
  }
});

test("every cluster touches another, so the comb is one connected piece", () => {
  // Islands were the complaint: clusters have to share a wall, not float.
  for (const count of COUNTS.filter((n) => n > capacity(CLUSTER_SIDE))) {
    const { cells } = combLayout(count);
    const per = capacity(CLUSTER_SIDE);
    const groups = new Map();
    for (const cell of cells) {
      const c = Math.floor(cell.index / per);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(cell);
    }

    // Cells one apart are neighbours; across a seam they sit a seam further.
    // Anything beyond that means the two clusters are not adjacent at all.
    const REACH = 1.15 + SEAM;
    const ids = [...groups.keys()];
    const seen = new Set([ids[0]]);
    const queue = [ids[0]];
    while (queue.length) {
      const a = queue.pop();
      for (const b of ids) {
        if (seen.has(b)) continue;
        const touching = groups
          .get(a)
          .some((p) => groups.get(b).some((q) => Math.hypot(p.x - q.x, p.y - q.y) < REACH));
        if (touching) {
          seen.add(b);
          queue.push(b);
        }
      }
    }
    assert.equal(seen.size, ids.length, `count ${count}: ${ids.length - seen.size} adrift`);
  }
});

test("no two cells overlap, at any word count", () => {
  // The property that catches a wrong pitch between clusters: cells are one
  // width apart inside a cluster and further apart across the mortar, so any
  // pair closer than a full width means two clusters have collided.
  for (const count of COUNTS) {
    const { cells } = combLayout(count);
    let closest = Infinity;
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const dx = cells[i].x - cells[j].x;
        const dy = cells[i].y - cells[j].y;
        closest = Math.min(closest, Math.hypot(dx, dy));
      }
    }
    if (count > 1) assert.ok(closest > 0.999, `count ${count}: cells ${closest} apart`);
  }
});

test("clusters are whole hexagons until the last one", () => {
  // 162 words is the default list: eight full clusters of 19 and one holding
  // the remaining ten, rather than a foreign shape tacked on the end.
  const per = capacity(CLUSTER_SIDE);
  assert.equal(per, 19);

  const { cells } = combLayout(162);
  const perCluster = new Map();
  for (const cell of cells) {
    const c = Math.floor(cell.index / per);
    perCluster.set(c, (perCluster.get(c) ?? 0) + 1);
  }
  assert.equal(perCluster.size, 9);
  for (const [c, n] of perCluster) assert.equal(n, c < 8 ? 19 : 10, `cluster ${c}`);
});

test("the bounding box holds every cell with exactly half a cell to spare", () => {
  for (const count of COUNTS) {
    const { cells, width, height } = combLayout(count);
    assert.ok(width > 0 && height > 0, `count ${count}`);
    for (const { x, y } of cells) {
      assert.ok(x >= 0.5 - 1e-9 && x <= width - 0.5 + 1e-9, `count ${count}: x ${x} of ${width}`);
      assert.ok(
        y >= CELL_H / 2 - 1e-9 && y <= height - CELL_H / 2 + 1e-9,
        `count ${count}: y ${y} of ${height}`
      );
    }
  }
});

test("a cluster is nineteen consecutive words, the same set the drill uses", async () => {
  const { CLUSTER_SIZE, clusterOf } = await import("./comb.js");
  const progress = await import("./progress.js");
  assert.equal(CLUSTER_SIZE, capacity(CLUSTER_SIDE));
  assert.equal(progress.CLUSTER_SIZE, CLUSTER_SIZE, "drill sets and comb clusters agree");
  for (const count of COUNTS) {
    const { cells } = combLayout(count);
    for (const cell of cells) assert.equal(cell.cluster, clusterOf(cell.index), `count ${count} cell ${cell.index}`);
  }
  const words = Array.from({ length: 162 }, (_, i) => `w${i}`);
  const { cells } = combLayout(162);
  const inThird = cells.filter((c) => c.cluster === 2).map((c) => words[c.index]).sort();
  assert.deepEqual(inThird, progress.poolFor("cluster:2", words, {}).sort());
});

test("arrow keys move to the nearest cell in that direction, and stop at the edge", async () => {
  const { neighbor } = await import("./comb.js");
  const { cells } = combLayout(162);
  const at = (i) => cells.find((c) => c.index === i);
  for (const from of [0, 5, 40, 100]) {
    for (const dir of ["left", "right", "up", "down"]) {
      const to = neighbor(cells, from, dir);
      if (to === null) continue;
      const dx = at(to).x - at(from).x;
      const dy = at(to).y - at(from).y;
      if (dir === "right") assert.ok(dx > 0.4, `${from} right`);
      if (dir === "left") assert.ok(dx < -0.4, `${from} left`);
      if (dir === "up") assert.ok(dy < -0.4, `${from} up`);
      if (dir === "down") assert.ok(dy > 0.4, `${from} down`);
      // An arrow never skips an adjacent cell lying that way: if a touching
      // neighbour exists in the direction, that is where it lands. Only at a
      // cluster's edge does it cross the seam to the next one.
      const u = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
      const adjacent = cells.some((c) => {
        const ex = c.x - at(from).x;
        const ey = c.y - at(from).y;
        const d = Math.hypot(ex, ey);
        return c.index !== from && d < 1.05 && (ex * u[0] + ey * u[1]) / d >= 0.34;
      });
      if (adjacent) assert.ok(Math.hypot(dx, dy) < 1.05, `${from} ${dir} skipped an adjacent cell`);
    }
  }
  // The leftmost cell has nowhere further left to go.
  const leftmost = cells.reduce((a, b) => (b.x < a.x ? b : a));
  assert.equal(neighbor(cells, leftmost.index, "left"), null);
});

test("words run in reading order inside a cluster, and clusters read down the comb", async () => {
  const { CLUSTER_SIZE } = await import("./comb.js");
  for (const count of COUNTS) {
    const { cells } = combLayout(count);
    const byCluster = new Map();
    for (const cell of cells) {
      if (!byCluster.has(cell.cluster)) byCluster.set(cell.cluster, []);
      byCluster.get(cell.cluster).push(cell);
    }
    for (const [c, group] of byCluster) {
      group.sort((a, b) => a.index - b.index);
      for (let i = 1; i < group.length; i++) {
        const a = group[i - 1];
        const b = group[i];
        const sameRow = Math.abs(a.y - b.y) < 0.1;
        assert.ok(sameRow ? b.x > a.x : b.y > a.y, `count ${count} cluster ${c}: word ${b.index} reads before ${a.index}`);
      }
    }
    // Cluster 1 sits in the top band of the comb; the full clusters never
    // jump back up a band as their numbers rise.
    const centre = (c) => {
      const g = byCluster.get(c);
      return { x: g.reduce((s, p) => s + p.x, 0) / g.length, y: g.reduce((s, p) => s + p.y, 0) / g.length };
    };
    const full = [...byCluster.keys()].filter((c) => byCluster.get(c).length === CLUSTER_SIZE).sort((a, b) => a - b);
    const tops = full.map((c) => centre(c).y);
    if (full.length > 1) assert.ok(tops[0] - Math.min(...tops) < 1.9, `count ${count}: cluster 1 is not in the top band`);
    for (let i = 1; i < full.length; i++) {
      assert.ok(tops[i] > tops[i - 1] - 1.9, `count ${count}: cluster ${full[i] + 1} sits above cluster ${full[i - 1] + 1}`);
    }
  }
});
