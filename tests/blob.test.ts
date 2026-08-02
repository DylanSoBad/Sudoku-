import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePuzzleBlob, encodePuzzleBlob, type PuzzleBlob } from "../lib/blob-layout";

const sample: PuzzleBlob = {
  level: 7,
  difficulty: "hard",
  hintCost: 0.4,
  reward: 2.5,
  ts: 1700000000000,
  puzzle: Array.from({ length: 81 }, (_, i) => (i % 9) + 1),
  solution: Array.from({ length: 81 }, (_, i) => ((i + 4) % 9) + 1),
};

test("encode then decode roundtrip preserves all fields", () => {
  const bytes = encodePuzzleBlob(sample);
  assert.ok(bytes.length > 162);
  const back = decodePuzzleBlob(bytes);
  assert.equal(back.level, sample.level);
  assert.equal(back.difficulty, sample.difficulty);
  assert.equal(back.hintCost, sample.hintCost);
  assert.equal(back.reward, sample.reward);
  assert.equal(back.ts, sample.ts);
  assert.deepEqual(back.puzzle, sample.puzzle);
  assert.deepEqual(back.solution, sample.solution);
});

test("clamping ensures every cell is in 0..9", () => {
  const crazy: PuzzleBlob = {
    ...sample,
    puzzle: Array.from({ length: 81 }, () => 255),
    solution: Array.from({ length: 81 }, () => -5),
  };
  const bytes = encodePuzzleBlob(crazy);
  const back = decodePuzzleBlob(bytes);
  for (const v of [...back.puzzle, ...back.solution]) {
    assert.ok(v >= 0 && v <= 9);
  }
});