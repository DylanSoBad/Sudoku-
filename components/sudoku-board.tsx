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
  setCursor: (i: number) => void;
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
      setCursor(i: number) {
        setCursor(i);
      },
    }),
    [cursor, isGiven, commit],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key;
      if (cursor < 0) return;
      if (k >= "1" && k <= "9") {
        const d = Number(k);
        if (isGiven[cursor]) {
          const first = findEmpty(ref0.current);
          if (first >= 0) {
            setCursor(first);
          }
          return;
        }
        const next = [...ref0.current];
        next[cursor] = d;
        commit(next);
        e.preventDefault();
        return;
      }
      if (k === "Backspace" || k === "Delete" || k === "0") {
        if (isGiven[cursor]) {
          const first = findEmpty(ref0.current);
          if (first >= 0) setCursor(first);
          return;
        }
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
      if (k === "Escape") {
        setCursor(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, commit, isGiven, puzzle]);

  function onCellClick(i: number) {
    setCursor(i);
  }

  const anchor = highlight ?? (cursor >= 0 ? cursor : undefined);
  const anchorDigit = anchor === undefined ? 0 : board[anchor];

  return (
    <div
      role="grid"
      aria-label="Sudoku board"
      className="inline-grid select-none grid-cols-9 border-2 border-zinc-700"
    >
      {board.map((v, i) => {
        const r = rowOf(i);
        const c = colOf(i);
        const isCursor = cursor >= 0 && i === cursor;
        const isPeer =
          anchor !== undefined &&
          anchor !== i &&
          (rowOf(anchor) === r ||
            colOf(anchor) === c ||
            (Math.floor(r / 3) === Math.floor(rowOf(anchor) / 3) &&
              Math.floor(c / 3) === Math.floor(colOf(anchor) / 3)));
        const isSameDigit = anchorDigit !== 0 && v === anchorDigit && !isCursor;
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            onClick={() => onCellClick(i)}
            aria-label={`row ${r + 1} column ${c + 1} value ${v || "empty"}`}
            className={cn(
              "flex h-9 w-9 items-center justify-center border-b border-r border-zinc-800",
              "bg-transparent font-mono text-lg outline-none transition-colors duration-100 sm:h-11 sm:w-11",
              (c === 2 || c === 5) && "border-r-2 border-r-zinc-600",
              (r === 2 || r === 5) && "border-b-2 border-b-zinc-600",
              c === 8 && "border-r-0",
              r === 8 && "border-b-0",
              isPeer && "bg-zinc-800/40",
              isSameDigit && "bg-zinc-800/70",
              isGiven[i] ? "font-medium text-zinc-100" : "font-normal text-zinc-300",
              conflictMask[i] && "text-danger",
              isCursor && "relative z-10 ring-2 ring-inset ring-accent",
            )}
          >
            {v === 0 ? "" : v}
          </button>
        );
      })}
    </div>
  );
});