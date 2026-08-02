"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { conflicts, findEmpty, isSolved, type Board } from "@/lib/sudoku";
import { cn } from "@/lib/utils";

export interface SudokuBoardProps {
  puzzle: Board;
  initial?: Board;
  onChange?: (board: Board) => void;
  onSolve?: () => void;
  highlight?: number;
}

export interface SudokuBoardHandle {
  setDigit: (d: number) => void;
  clear: () => void;
  fillHint: (idx: number, digit: number) => void;
  getBoard: () => Board;
}

export interface SudokuBoardStats {
  filled: number;
  conflicts: number;
}

function rowOf(i: number) { return (i / 9) | 0; }
function colOf(i: number) { return i % 9; }

export const SudokuBoard = forwardRef<SudokuBoardHandle, SudokuBoardProps>(function SudokuBoard(
  { puzzle, initial, onChange, onSolve, highlight },
  ref,
) {
  const [board, setBoard] = useState<Board>(() => initial ?? [...puzzle]);
  const [cursor, setCursor] = useState<number>(0);
  const ref0 = useRef(board);
  ref0.current = board;

  useEffect(() => {
    setBoard(initial ?? [...puzzle]);
  }, [puzzle, initial]);

  const conflictMask = useMemo(() => conflicts(board), [board]);
  const isGiven = useMemo(() => puzzle.map((v) => v !== 0), [puzzle]);

  const commit = useCallback(
    (next: Board) => {
      setBoard(next);
      onChange?.(next);
      if (isSolved(next)) onSolve?.();
    },
    [onChange, onSolve],
  );

  useImperativeHandle(
    ref,
    () => ({
      setDigit(d: number) {
        if (isGiven[cursor]) return;
        const next = [...ref0.current];
        next[cursor] = d === 0 ? 0 : Math.max(1, Math.min(9, d));
        commit(next);
      },
      clear() {
        if (isGiven[cursor]) return;
        const next = [...ref0.current];
        next[cursor] = 0;
        commit(next);
      },
      fillHint(idx: number, digit: number) {
        if (isGiven[idx]) return;
        const next = [...ref0.current];
        next[idx] = digit;
        commit(next);
        setCursor(idx);
      },
      getBoard: () => [...ref0.current],
    }),
    [cursor, isGiven, commit],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key;
      if (k >= "1" && k <= "9") {
        const d = Number(k);
        if (isGiven[cursor]) return;
        const next = [...ref0.current];
        next[cursor] = d;
        commit(next);
        e.preventDefault();
        return;
      }
      if (k === "Backspace" || k === "Delete" || k === "0") {
        if (isGiven[cursor]) return;
        const next = [...ref0.current];
        next[cursor] = 0;
        commit(next);
        e.preventDefault();
        return;
      }
      if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") {
        let next = cursor;
        const r = rowOf(cursor);
        const c = colOf(cursor);
        if (k === "ArrowUp") next = Math.max(0, (r - 1) * 9 + c);
        if (k === "ArrowDown") next = Math.min(80, (r + 1) * 9 + c);
        if (k === "ArrowLeft") next = Math.max(0, r * 9 + Math.max(0, c - 1));
        if (k === "ArrowRight") next = Math.min(80, r * 9 + Math.min(8, c + 1));
        setCursor(next);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, commit, isGiven]);

  function onCellClick(i: number) {
    setCursor(i);
  }

  return (
    <div
      role="grid"
      aria-label="Sudoku board"
      className="relative w-full max-w-md select-none overflow-hidden rounded-lg border-2 border-white/40 bg-shelby-border"
    >
      <div className="grid w-full grid-cols-9 bg-shelby-border">
        {board.map((v, i) => {
          const r = rowOf(i);
          const c = colOf(i);
          const isCursor = i === cursor;
          const isHighlight =
            highlight !== undefined &&
            (rowOf(highlight) === r ||
              colOf(highlight) === c ||
              (Math.floor(r / 3) === Math.floor(rowOf(highlight) / 3) &&
                Math.floor(c / 3) === Math.floor(colOf(highlight) / 3)));
          const rightBoxEdge = c === 2 || c === 5;
          const bottomBoxEdge = r === 2 || r === 5;
          const outerRight = c === 8;
          const outerBottom = r === 8;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              onClick={() => onCellClick(i)}
              aria-label={`row ${r + 1} column ${c + 1} value ${v || "empty"}`}
              className={cn(
                "flex aspect-square items-center justify-center bg-shelby-bg text-base font-semibold",
                "border-white/10",
                rightBoxEdge ? "border-r-2 border-r-white/40" : "border-r",
                bottomBoxEdge ? "border-b-2 border-b-white/40" : "border-b",
                outerRight && "border-r-0",
                outerBottom && "border-b-0",
                isGiven[i] ? "text-shelby-fg-strong" : "text-shelby-accent2",
                conflictMask[i] && "text-shelby-danger",
                isCursor && "ring-2 ring-shelby-accent",
                isHighlight && !isCursor && "bg-shelby-surface",
              )}
            >
              {v === 0 ? "" : v}
            </button>
          );
        })}
      </div>
    </div>
  );
});