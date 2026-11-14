import type { CSSProperties } from "react";

// The three people on stage, drawn from blocks on a 30x36 grid: big head, small body, one dark
// outline around the whole figure and flat colours inside (no gradients, as in the style guide).
// Each has its own silhouette so they are told apart at a glance, even dimmed:
// orange = dark quiff and moustache, blue = blond side parting and glasses,
// moderator = bald with grey tufts, big glasses and the gold sash.
export type Who = "orange" | "blue" | "moderator";

const K = "#1E1A16";
const SKIN = "#E3B48A";
const SKIN_SHADE = "#C08F66";
const BLUSH = "#D9806A";
const WHITE = "#F4EFE4";
const LOOK: Record<Who, { suit: string; shade: string; hair: string; light: string; tie: string }> = {
  orange: { suit: "#C8693A", shade: "#8E4526", hair: "#3B2A20", light: "#5E4636", tie: "#1E1A16" },
  blue: { suit: "#3A8CB0", shade: "#25607C", hair: "#D2A84A", light: "#EBCB7A", tie: "#1E1A16" },
  moderator: { suit: "#6E6A60", shade: "#4E4A42", hair: "#B5B0A4", light: "#D6D2C6", tie: "#A8443A" },
};

type Box = [x: number, y: number, w: number, h: number, fill: string];

function parts(who: Who, talk: boolean): { solid: Box[]; detail: Box[] } {
  const c = LOOK[who];
  // Solid parts get the outline; details are drawn on top without one.
  const solid: Box[] = [
    // legs and shoes
    [10, 29, 4, 4, "#2E2A30"],
    [16, 29, 4, 4, "#2E2A30"],
    [9, 33, 5, 2, K],
    [16, 33, 5, 2, K],
    // body
    [8, 20, 14, 9, c.suit],
    // left arm (hangs) and hand
    [5, 21, 3, 6, c.suit],
    [5, 27, 3, 2, SKIN],
    // right arm: raised while talking
    ...(talk ? ([[22, 15, 3, 8, c.suit], [22, 12, 3, 3, SKIN]] as Box[]) : ([[22, 21, 3, 6, c.suit], [22, 27, 3, 2, SKIN]] as Box[])),
    // head
    [5, 4, 20, 15, SKIN],
  ];
  const detail: Box[] = [
    // suit: shade at the sides, shirt and tie
    [8, 20, 2, 9, c.shade],
    [20, 20, 2, 9, c.shade],
    [13, 20, 4, 4, WHITE],
    [14, 20, 2, 6, c.tie],
    // face: jaw shade, cheeks
    [5, 17, 20, 2, SKIN_SHADE],
    [7, 14, 2, 2, BLUSH],
    [21, 14, 2, 2, BLUSH],
  ];
  // eyes (with a glint) and brows
  const eyes: Box[] = [
    [10, 11, 2, 3, K],
    [18, 11, 2, 3, K],
    [10, 11, 1, 1, WHITE],
    [18, 11, 1, 1, WHITE],
  ];
  const mouth: Box[] = talk ? [[12, 15, 6, 3, K], [13, 17, 4, 1, "#A8443A"]] : [[12, 16, 6, 1, K]];

  if (who === "orange") {
    solid.push([5, 2, 20, 5, c.hair], [8, 0, 14, 3, c.hair]); // quiff
    detail.push([10, 1, 8, 1, c.light], [5, 7, 2, 4, c.hair], [23, 7, 2, 4, c.hair]);
    detail.push([9, 9, 4, 1, c.hair], [17, 9, 4, 1, c.hair], ...eyes);
    detail.push(...mouth, [11, talk ? 14 : 15, 8, 1, c.hair]); // moustache
  } else if (who === "blue") {
    solid.push([5, 2, 20, 5, c.hair]);
    detail.push([5, 7, 9, 2, c.hair], [7, 3, 12, 1, c.light], [23, 7, 2, 3, c.hair]); // side parting
    detail.push(...eyes);
    // thin glasses
    detail.push([8, 10, 6, 1, K], [8, 14, 6, 1, K], [8, 10, 1, 5, K], [13, 10, 1, 5, K], [16, 10, 6, 1, K], [16, 14, 6, 1, K], [16, 10, 1, 5, K], [21, 10, 1, 5, K], [14, 12, 2, 1, K]);
    detail.push(...mouth);
  } else {
    solid.push([3, 9, 2, 6, c.hair], [25, 9, 2, 6, c.hair]); // tufts
    detail.push([8, 5, 6, 1, "#F0CBA6"]); // shine on the bald head
    // big glasses with white lenses
    detail.push([7, 9, 7, 6, K], [16, 9, 7, 6, K], [14, 11, 2, 1, K], [8, 10, 5, 4, WHITE], [17, 10, 5, 4, WHITE], [10, 11, 2, 2, K], [19, 11, 2, 2, K]);
    detail.push(...mouth);
    // gold sash, shoulder to hip
    for (let i = 0; i < 7; i++) detail.push([9 + i * 2 - (i > 5 ? 1 : 0), 20 + i, 3, 2, "#C9A43A"]);
  }
  return { solid, detail };
}

export function Character({ who, talk = false, flip, style }: { who: Who; talk?: boolean; flip?: boolean; style?: CSSProperties }) {
  const { solid, detail } = parts(who, talk);
  return (
    <svg viewBox="-1 -1 32 38" shapeRendering="crispEdges" role="img" aria-label={who === "moderator" ? "The moderator" : `The ${who} candidate`} style={{ display: "block", height: "100%", transform: flip ? "scaleX(-1)" : undefined, ...style }}>
      {/* Outline first: every solid block, one unit larger on each side. */}
      {solid.map(([x, y, w, h], i) => (
        <rect key={`o${i}`} x={x - 1} y={y - 1} width={w + 2} height={h + 2} fill={K} />
      ))}
      {[...solid, ...detail].map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
    </svg>
  );
}
