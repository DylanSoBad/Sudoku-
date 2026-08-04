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
  /** Controlled notes mode from the parent toolbar. */
  notesMode?: boolean;
}

export interface SudokuBoardHandle {
  setDigit: (d: number) => void;
  clear: () => void;
  fillHint: (idx: number, digit: number) => void;
  getBoard: () => Board;
  setCursor: (i: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

type NotesMap = Record<number, number[]>;

function rowOf(i: number) {
  return (i / 9) | 0;
}
function colOf(i: number) {
  return i % 9;
}

function emptyNotes(): NotesMap {
  return {};
}

function cloneNotes(n: NotesMap): NotesMap {
  const out: NotesMap = {};
  for (const k of Object.keys(n)) {
    const i = Number(k);
    out[i] = [...(n[i] ?? [])];
  }
  return out;
}

interface Snapshot {
  board: Board;
  notes: NotesMap;
}

export const SudokuBoard = forwardRef<SudokuBoardHandle, SudokuBoardProps>(function SudokuBoard(
  { puzzle, initial, onChange, onSolve, highlight, notesMode = false },
  ref,
) {
  const [board, setBoard] = useState<Board>(() => initial ?? [...puzzle]);
  const [notes, setNotes] = useState<NotesMap>(emptyNotes);
  const [cursor, setCursor] = useState<number>(0);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);

  const boardRef = useRef(board);
  const notesRef = useRef(notes);
  boardRef.current = board;
  notesRef.current = notes;
  const notesModeRef = useRef(notesMode);
  notesModeRef.current = notesMode;

  useEffect(() => {
    setBoard(initial ?? [...puzzle]);
    setNotes(emptyNotes());
    setPast([]);
    setFuture([]);
    setCursor(findEmpty(initial ?? puzzle) >= 0 ? findEmpty(initial ?? puzzle) : 0);
  }, [puzzle, initial]);

  const conflictMask = useMemo(() => conflicts(board), [board]);
  const isGiven = useMemo(() => puzzle.map((v) => v !== 0), [puzzle]);

  const pushHistory = useCallback((prevBoard: Board, prevNotes: NotesMap) => {
    setPast((p) => [...p.slice(-99), { board: [...prevBoard], notes: cloneNotes(prevNotes) }]);
    setFuture([]);
  }, []);

  const commitBoard = useCallback(
    (next: Board, nextNotes?: NotesMap) => {
      pushHistory(boardRef.current, notesRef.current);
      setBoard(next);
      if (nextNotes) setNotes(nextNotes);
      onChange?.(next);
      if (isSolved(next)) onSolve?.();
    },
    [onChange, onSolve, pushHistory],
  );

  const applyDigit = useCallback(
    (d: number, at?: number) => {
      const i = at ?? cursor;
      if (i < 0 || isGiven[i]) return;
      const digit = d === 0 ? 0 : Math.max(1, Math.min(9, d));

      if (notesModeRef.current && digit !== 0) {
        const cur = notesRef.current[i] ?? [];
        const has = cur.includes(digit);
        const nextNotes = cloneNotes(notesRef.current);
        nextNotes[i] = has ? cur.filter((x) => x !== digit) : [...cur, digit].sort();
        // Clear a filled digit when entering notes on that cell.
        if (boardRef.current[i] !== 0) {
          const nextBoard = [...boardRef.current];
          nextBoard[i] = 0;
          commitBoard(nextBoard, nextNotes);
        } else {
          pushHistory(boardRef.current, notesRef.current);
          setNotes(nextNotes);
        }
        return;
      }

      const next = [...boardRef.current];
      next[i] = digit;
      const nextNotes = cloneNotes(notesRef.current);
      delete nextNotes[i];
      commitBoard(next, nextNotes);
    },
    [cursor, isGiven, commitBoard, pushHistory],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [
        { board: [...boardRef.current], notes: cloneNotes(notesRef.current) },
        ...f,
      ]);
      setBoard(prev.board);
      setNotes(prev.notes);
      onChange?.(prev.board);
      return p.slice(0, -1);
    });
  }, [onChange]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const [next, ...rest] = f;
      setPast((p) => [
        ...p,
        { board: [...boardRef.current], notes: cloneNotes(notesRef.current) },
      ]);
      setBoard(next.board);
      setNotes(next.notes);
      onChange?.(next.board);
      return rest;
    });
  }, [onChange]);

  useImperativeHandle(
    ref,
    () => ({
      setDigit(d: number) {
        applyDigit(d);
      },
      clear() {
        applyDigit(0);
      },
      fillHint(idx: number, digit: number) {
        if (isGiven[idx]) return;
        const next = [...boardRef.current];
        next[idx] = digit;
        const nextNotes = cloneNotes(notesRef.current);
        delete nextNotes[idx];
        commitBoard(next, nextNotes);
        setCursor(idx);
      },
      getBoard: () => [...boardRef.current],
      setCursor(i: number) {
        setCursor(i);
      },
      undo,
      redo,
      canUndo: () => past.length > 0,
      canRedo: () => future.length > 0,
    }),
    [applyDigit, commitBoard, isGiven, undo, redo, past.length, future.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key;
      if (cursor < 0) return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && (k === "z" || k === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (k === "y" || k === "Y")) {
        e.preventDefault();
        redo();
        return;
      }

      if (k >= "1" && k <= "9") {
        if (isGiven[cursor]) {
          const first = findEmpty(boardRef.current);
          if (first >= 0) setCursor(first);
          return;
        }
        applyDigit(Number(k));
        e.preventDefault();
        return;
      }
      if (k === "Backspace" || k === "Delete" || k === "0") {
        if (isGiven[cursor]) {
          const first = findEmpty(boardRef.current);
          if (first >= 0) setCursor(first);
          return;
        }
        applyDigit(0);
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
      if (k === "Escape") setCursor(-1);
      if (k === "Tab") {
        e.preventDefault();
        // Jump to next empty cell (or previous with shift).
        const start = cursor < 0 ? 0 : cursor;
        if (e.shiftKey) {
          for (let step = 1; step <= 81; step++) {
            const i = (start - step + 81) % 81;
            if (!isGiven[i] && boardRef.current[i] === 0) {
              setCursor(i);
              return;
            }
          }
        } else {
          for (let step = 1; step <= 81; step++) {
            const i = (start + step) % 81;
            if (!isGiven[i] && boardRef.current[i] === 0) {
              setCursor(i);
              return;
            }
          }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, isGiven, applyDigit, undo, redo]);

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
        const cellNotes = !v ? notes[i] ?? [] : [];
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            onClick={() => setCursor(i)}
            aria-label={`row ${r + 1} column ${c + 1} value ${v || "empty"}`}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center border-b border-r border-zinc-800",
              "bg-transparent font-mono outline-none transition-colors duration-100 sm:h-11 sm:w-11",
              (c === 2 || c === 5) && "border-r-2 border-r-zinc-600",
              (r === 2 || r === 5) && "border-b-2 border-b-zinc-600",
              c === 8 && "border-r-0",
              r === 8 && "border-b-0",
              isPeer && "bg-zinc-800/40",
              isSameDigit && "bg-zinc-800/70",
              isGiven[i] ? "text-lg font-medium text-zinc-100" : "text-lg font-normal text-zinc-300",
              conflictMask[i] && !isGiven[i] && "bg-danger/10 text-danger",
              conflictMask[i] && isGiven[i] && "text-danger",
              isCursor && "relative z-10 ring-2 ring-inset ring-accent",
            )}
          >
            {v !== 0 ? (
              v
            ) : cellNotes.length > 0 ? (
              <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-0.5 text-[9px] leading-none text-content-muted sm:text-[10px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <span key={d} className="flex items-center justify-center">
                    {cellNotes.includes(d) ? d : ""}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
