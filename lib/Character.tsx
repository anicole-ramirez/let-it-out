import type { CSSProperties } from "react";

// The three people on stage, drawn from blocks on a 30x36 grid: big head, small body, one dark
// outline around the whole figure and flat colours inside (no gradients, as in the style guide).
// Who someone is on stage is told by the suit alone (orange, blue, grey for the moderator).
// Skin, hair and face are rolled fresh every round, so no party or role is tied to one look.
export type Who = "orange" | "blue" | "moderator";

const K = "#1E1A16";
const WHITE = "#F4EFE4";
const SUIT: Record<Who, { suit: string; shade: string; tie: string }> = {
  orange: { suit: "#C8693A", shade: "#8E4526", tie: "#1E1A16" },
  blue: { suit: "#3A8CB0", shade: "#25607C", tie: "#1E1A16" },
  moderator: { suit: "#6E6A60", shade: "#4E4A42", tie: "#A8443A" },
};

// [skin, shade, cheeks]
const SKINS = [
  ["#F2CFA8", "#D4A77C", "#E08E7A"],
  ["#E3B48A", "#C08F66", "#D9806A"],
  ["#C68E5E", "#A06E42", "#B5604A"],
  ["#A0683C", "#7C4C28", "#8E4A38"],
  ["#74482A", "#573418", "#6A3628"],
  ["#4E3020", "#38200F", "#4A2418"],
];
// [hair, highlight]
const HAIRS = [
  ["#1E1A16", "#3A342E"],
  ["#3B2A20", "#5E4636"],
  ["#6E4A2A", "#8E6A44"],
  ["#D2A84A", "#EBCB7A"],
  ["#8A3A22", "#A85436"],
  ["#9A958A", "#C4C0B4"],
  ["#D6D2C6", "#F4EFE4"],
];
const STYLES = ["quiff", "parting", "bald", "bob", "afro", "bun"] as const;
const GLASSES = ["none", "none", "thin", "big"] as const;
const FACES = ["none", "none", "moustache", "beard"] as const;

export type Look = { skin: number; hair: number; style: (typeof STYLES)[number]; glasses: (typeof GLASSES)[number]; face: (typeof FACES)[number] };
export type Cast = Record<Who, Look>;

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const roll = (): Look => ({ skin: Math.floor(Math.random() * SKINS.length), hair: Math.floor(Math.random() * HAIRS.length), style: pick(STYLES), glasses: pick(GLASSES), face: pick(FACES) });

// A new cast for a round. The three never share a hairstyle, so they stay easy to tell apart
// even when dimmed.
export function rollCast(): Cast {
  const cast = { orange: roll(), blue: roll(), moderator: roll() };
  while (cast.blue.style === cast.orange.style) cast.blue.style = pick(STYLES);
  while (cast.moderator.style === cast.orange.style || cast.moderator.style === cast.blue.style) cast.moderator.style = pick(STYLES);
  return cast;
}
// Used until a round has rolled its own.
export const FIRST_CAST: Cast = {
  orange: { skin: 3, hair: 0, style: "quiff", glasses: "none", face: "moustache" },
  blue: { skin: 0, hair: 3, style: "bob", glasses: "thin", face: "none" },
  moderator: { skin: 5, hair: 5, style: "bald", glasses: "big", face: "none" },
};

type Box = [x: number, y: number, w: number, h: number, fill: string];

function parts(who: Who, look: Look, talk: boolean): { solid: Box[]; detail: Box[] } {
  const c = SUIT[who];
  const [skin, skinShade, blush] = SKINS[look.skin];
  const [hair, light] = HAIRS[look.hair];
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
    [5, 27, 3, 2, skin],
    // right arm: raised while talking
    ...(talk ? ([[22, 15, 3, 8, c.suit], [22, 12, 3, 3, skin]] as Box[]) : ([[22, 21, 3, 6, c.suit], [22, 27, 3, 2, skin]] as Box[])),
    // head
    [5, 4, 20, 15, skin],
  ];
  const detail: Box[] = [
    // suit: shade at the sides, shirt and tie
    [8, 20, 2, 9, c.shade],
    [20, 20, 2, 9, c.shade],
    [13, 20, 4, 4, WHITE],
    [14, 20, 2, 6, c.tie],
    // face: jaw shade, cheeks
    [5, 17, 20, 2, skinShade],
    [7, 14, 2, 2, blush],
    [21, 14, 2, 2, blush],
  ];

  // Hair
  if (look.style === "quiff") {
    solid.push([5, 2, 20, 5, hair], [8, 0, 14, 3, hair]);
    detail.push([10, 1, 8, 1, light], [5, 7, 2, 4, hair], [23, 7, 2, 4, hair]);
  } else if (look.style === "parting") {
    solid.push([5, 2, 20, 5, hair]);
    detail.push([5, 7, 9, 2, hair], [7, 3, 12, 1, light], [23, 7, 2, 3, hair]);
  } else if (look.style === "bald") {
    solid.push([3, 9, 2, 6, hair], [25, 9, 2, 6, hair]);
    detail.push([8, 5, 6, 1, WHITE + "66"]);
  } else if (look.style === "bob") {
    solid.push([4, 2, 22, 6, hair], [3, 7, 3, 13, hair], [24, 7, 3, 13, hair]);
    detail.push([8, 3, 10, 1, light], [6, 8, 6, 1, hair]);
  } else if (look.style === "afro") {
    solid.push([3, 0, 24, 8, hair], [2, 4, 3, 9, hair], [25, 4, 3, 9, hair]);
    detail.push([7, 2, 2, 2, light], [13, 1, 2, 2, light], [19, 3, 2, 2, light], [5, 8, 2, 3, hair], [23, 8, 2, 3, hair]);
  } else {
    solid.push([5, 2, 20, 5, hair], [11, -2, 8, 4, hair]);
    detail.push([13, -1, 4, 1, light], [8, 3, 12, 1, light]);
  }

  // Eyes (white with a dark pupil, readable on every skin tone) and brows
  detail.push([9, 11, 3, 3, WHITE], [18, 11, 3, 3, WHITE], [10, 11, 2, 3, K], [19, 11, 2, 3, K]);
  if (look.style !== "bald" && look.glasses !== "big") detail.push([9, 9, 4, 1, hair], [17, 9, 4, 1, hair]);
  if (look.glasses === "thin") detail.push([8, 10, 6, 1, K], [8, 14, 6, 1, K], [8, 10, 1, 5, K], [13, 10, 1, 5, K], [16, 10, 6, 1, K], [16, 14, 6, 1, K], [16, 10, 1, 5, K], [21, 10, 1, 5, K], [14, 12, 2, 1, K]);
  if (look.glasses === "big") detail.push([7, 9, 7, 1, K], [7, 14, 7, 1, K], [7, 9, 1, 6, K], [13, 9, 1, 6, K], [16, 9, 7, 1, K], [16, 14, 7, 1, K], [16, 9, 1, 6, K], [22, 9, 1, 6, K], [14, 11, 2, 1, K]);

  // Beard goes under the mouth, moustache over it
  if (look.face === "beard") detail.push([5, 14, 3, 5, hair], [22, 14, 3, 5, hair], [8, 16, 14, 3, hair]);
  detail.push(...(talk ? ([[12, 15, 6, 3, K], [13, 17, 4, 1, "#C8504A"]] as Box[]) : ([[12, 16, 6, 1, look.face === "beard" ? WHITE : K]] as Box[])));
  if (look.face === "moustache") detail.push([11, talk ? 14 : 15, 8, 1, hair]);
  return { solid, detail };
}

export function Character({ who, look, talk = false, flip, style }: { who: Who; look: Look; talk?: boolean; flip?: boolean; style?: CSSProperties }) {
  const { solid, detail } = parts(who, look, talk);
  return (
    <svg viewBox="-1 -3 32 40" shapeRendering="crispEdges" role="img" aria-label={who === "moderator" ? "The moderator" : `The ${who} candidate`} style={{ display: "block", height: "100%", transform: flip ? "scaleX(-1)" : undefined, ...style }}>
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
