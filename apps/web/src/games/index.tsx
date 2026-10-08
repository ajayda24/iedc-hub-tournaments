"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { GameId } from "@iedc/shared/games/types";
import type { ViewProps } from "./types";
import { gameText as G } from "@iedc/data/copy/games";

const Loading = () => <p className="hand py-16 text-center text-xl text-pencil">{G.loading}</p>;

/** Game views are split into their own chunks — phones only download what's being played. */
export const VIEWS: Record<GameId, ComponentType<ViewProps<any, any>>> = {
  sudoku: dynamic(() => import("./SudokuView"), { ssr: false, loading: Loading }),
  wordhunt: dynamic(() => import("./WordHuntView"), { ssr: false, loading: Loading }),
  anagram: dynamic(() => import("./AnagramView"), { ssr: false, loading: Loading }),
  numbercrunch: dynamic(() => import("./NumberCrunchView"), { ssr: false, loading: Loading }),
};
