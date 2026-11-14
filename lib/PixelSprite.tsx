import type { CSSProperties } from "react";
import data from "./sprites.json";

// Pixel characters from the design handoff: one letter per pixel, "." = transparent.
// Letters map to the fixed palette; C/c (suit, shade) and H/h (hair, shade) are set per character.
export type SpriteName = keyof typeof data.sprites;
export type Slots = { C: string; c: string; H: string; h: string };

export const SLOTS: Record<"orange" | "blue" | "moderator", Slots> = {
  orange: data.teams.A,
  blue: data.teams.B,
  moderator: data.teams.moderator,
};

// Hair colours for the crowd (colour, shade).
export const HAIR: [string, string][] = [
  ["#3B2A20", "#24180F"],
  ["#A88A4A", "#6E5A2E"],
  ["#9A958A", "#6E6A60"],
  ["#A8443A", "#6E2A24"],
  ["#1E1A16", "#000000"],
];

export function PixelSprite({ name, slots, flip, style }: { name: SpriteName; slots?: Partial<Slots>; flip?: boolean; style?: CSSProperties }) {
  const rows = data.sprites[name];
  const colors: Record<string, string> = { ...data.palette, ...SLOTS.moderator, ...slots };
  // One <rect> per horizontal run of the same colour.
  const rects = rows.flatMap((row, y) => {
    const out = [];
    for (let x = 0, n = 1; x < row.length; x += n) {
      for (n = 1; row[x + n] === row[x]; n++);
      if (row[x] !== ".") out.push(<rect key={`${x},${y}`} x={x} y={y} width={n} height={1} fill={colors[row[x]]} />);
    }
    return out;
  });
  return (
    <svg viewBox={`0 0 ${rows[0].length} ${rows.length}`} shapeRendering="crispEdges" style={{ display: "block", height: "100%", transform: flip ? "scaleX(-1)" : undefined, ...style }}>
      {rects}
    </svg>
  );
}
