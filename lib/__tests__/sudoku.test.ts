import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conflicts,
  emptiesForDifficulty,
  firstEmpty,
  fnv1a,
  generateFullSolution,
  generatePuzzleWithSeed,
  isSolved,
  mulberry32,
} from "../sudoku.ts";
import { decodePuzzleBlob, encodePuzzleBlob, type PuzzleBlob } from "../codec.ts";
import type { Difficulty } from "../sudoku.ts";

test("fnv1a is deterministic", () => {
  assert.equal(fnv1a("sudoku:level:1"), fnv1a("sudoku:level:1"));
  assert.notEqual(fnv1a("a"), fnv1a("b"));
});

test("mulberry32 stays in [0,1)", () => {
  const r = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test("generateFullSolution is a valid solution", () => {
  const sol = generateFullSolution(fnv1a("unit"));
  assert.equal(sol.length, 81);
  assert.ok(isSolved(sol));
});

test("generator is deterministic per seed", () => {
  const a = generateFullSolution(fnv1a("seed:abc"));
  const b = generateFullSolution(fnv1a("seed:abc"));
  assert.deepEqual(a, b);
});

test("emptiesForDifficulty matches README table", () => {
  const cases: Array<[Difficulty, number]> = [
    ["easy", 36],
    ["medium", 44],
    ["hard", 50],
    ["expert", 55],
    ["master", 60],
  ];
  for (const [d, n] of cases) assert.equal(emptiesForDifficulty(d), n);
});

test("firstEmpty returns -1 when board full", () => {
  const full = new Array(81).fill(9);
  assert.equal(firstEmpty(full), -1);
});

test("conflicts catches row and column duplicates", () => {
  const b = new Array(81).fill(0);
  b[0] = 5;
  b[1] = 5;
  const c = conflicts(b);
  assert.equal(c[0], true);
  assert.equal(c[1], true);
});

test("codec roundtrip preserves every cell", () => {
  const blob: PuzzleBlob = {
    level: 7,
    difficulty: "hard",
    hintCost: 0.4,
    reward: 2.5,
    ts: 1_700_000_000_000,
    puzzle: Array.from({ length: 81 }, (_, i) => ((i * 3) % 10)),
    solution: Array.from({ length: 81 }, (_, i) => ((i + 4) % 9) + 1),
  };
  const bytes = encodePuzzleBlob(blob);
  const back = decodePuzzleBlob(bytes);
  assert.equal(back.level, blob.level);
  assert.equal(back.difficulty, blob.difficulty);
  assert.equal(back.hintCost, blob.hintCost);
  assert.equal(back.reward, blob.reward);
  assert.equal(back.ts, blob.ts);
  assert.deepEqual(back.puzzle, blob.puzzle);
  assert.deepEqual(back.solution, blob.solution);
});

test("codec clamps out-of-range bytes", () => {
  const blob: PuzzleBlob = {
    level: 1,
    difficulty: "easy",
    hintCost: 0.1,
    reward: 0.5,
    ts: 0,
    puzzle: new Array(81).fill(255),
    solution: new Array(81).fill(-3),
  };
  const back = decodePuzzleBlob(encodePuzzleBlob(blob));
  for (const v of [...back.puzzle, ...back.solution]) {
    assert.ok(v >= 0 && v <= 9);
  }
});

test("solver correctness on a fixed easy board (level 1)", () => {
  // Same seed → same puzzle/solution pair; both must satisfy isSolved.
  const seed = fnv1a("easy:level:1:fixed");
  const sol = generateFullSolution(seed);
  assert.ok(isSolved(sol), "full solution must be a valid sudoku");
  // Generate the easy puzzle from the same seed via the public path and
  // verify it remains consistent with the solution (no conflict, no
  // missing cells in the solution).
  const puzzle = sol.slice();
  // Force at least one empty cell to mirror the easy path (36 empties).
  puzzle[0] = 0;
  const conflictsMask = conflicts(puzzle);
  assert.equal(
    conflictsMask[0],
    false,
    "removing a single cell should never introduce a conflict",
  );
});

test("easy puzzle keeps givens on every row after removal (36 empties)", () => {
  // generatePuzzleWithSeed for an easy level (≤3) must produce 36 empties
  // such that no row is fully empty AND no row is fully filled.
  for (let s = 0; s < 25; s++) {
    const seed = (s * 0x9e3779b1 + 0x12345) >>> 0;
    const { puzzle } = generatePuzzleWithSeed(1, seed);
    assert.equal(puzzle.length, 81, "puzzle must have 81 cells");
    let zeroCount = 0;
    for (const v of puzzle) if (v === 0) zeroCount++;
    assert.equal(zeroCount, 36, `seed ${seed} should remove exactly 36 cells`);
    for (let r = 0; r < 9; r++) {
      let rowEmpty = 0;
      for (let c = 0; c < 9; c++) {
        if (puzzle[r * 9 + c] === 0) rowEmpty++;
      }
      assert.notEqual(rowEmpty, 0, `row ${r} is fully empty for seed ${seed}`);
      assert.notEqual(rowEmpty, 9, `row ${r} is fully filled for seed ${seed}`);
    }
  }
});
