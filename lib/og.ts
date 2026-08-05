/**
 * Open Graph / Twitter card helpers.
 * Images come from the edge `/api/og` route (1200×630).
 */
import type { Metadata } from "next";
import {
  difficultyForLevel,
  HINT_COST_SUSD,
  REWARD_PER_LEVEL_SUSD,
} from "./tokenomics";

const SITE = "https://sudoku-d.vercel.app";

export function ogImageUrl(params?: { level?: number | string }): string {
  const url = new URL("/api/og", SITE);
  if (params?.level !== undefined) {
    url.searchParams.set("level", String(params.level));
  }
  return url.toString();
}

export function homeShareMetadata(): Metadata {
  const title = "Sudoku on Shelby";
  const description =
    "Campaign sudoku on Aptos and Shelby. Earn shelbyUSD, climb 20 levels.";
  const image = ogImageUrl();
  return {
    title,
    description,
    openGraph: {
      type: "website",
      url: SITE,
      title,
      description,
      siteName: "Sudoku on Shelby",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function levelShareMetadata(level: number): Metadata {
  const diff = difficultyForLevel(level);
  const title = `Sudoku on Shelby · Level ${level}`;
  const description = `${diff.toUpperCase()} · hint ${HINT_COST_SUSD} shelbyUSD · reward ${REWARD_PER_LEVEL_SUSD} shelbyUSD`;
  const image = ogImageUrl({ level });
  return {
    title,
    description,
    openGraph: {
      title: `Level ${level} — Sudoku on Shelby`,
      description: `${diff} puzzle on Shelby blob storage.`,
      images: [{ url: image, width: 1200, height: 630, alt: `Level ${level}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Level ${level} — Sudoku on Shelby`,
      description: `${diff} puzzle on Shelby blob storage.`,
      images: [image],
    },
  };
}
