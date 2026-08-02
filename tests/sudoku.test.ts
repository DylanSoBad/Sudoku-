// Re-export the lib test runner so `npm test` (node --test tests) finds it.
// Node ESM resolution requires the .ts extension.
import "../lib/__tests__/sudoku.test.ts";
