/** Stable pastel palette for slot titles — same title → same color. */
const SLOT_COLORS = [
  { bg: "#d7efe6", border: "#1f6f5b", text: "#145044" }, // teal
  { bg: "#e3edf8", border: "#3b6ea5", text: "#1e3a5f" }, // blue
  { bg: "#f3e6d8", border: "#a66b3a", text: "#5c3a1e" }, // clay
  { bg: "#ece4f5", border: "#6f4f9a", text: "#3d2a5c" }, // plum
  { bg: "#f6e8d0", border: "#b0892d", text: "#5c4a14" }, // gold
  { bg: "#ddece3", border: "#4a7c59", text: "#243d2c" }, // moss
  { bg: "#f8e2e0", border: "#a8574f", text: "#5c2a26" }, // rose
  { bg: "#e2e8f0", border: "#54728f", text: "#2a3a4a" }, // slate
] as const;

const NEUTRAL = {
  bg: "#ebe4d6",
  border: "#a89f8c",
  text: "#4a453c",
} as const;

function hashTitle(title: string): number {
  const normalized = title.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function slotColorFromTitle(title: string | null | undefined) {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) return NEUTRAL;
  return SLOT_COLORS[hashTitle(trimmed) % SLOT_COLORS.length];
}
